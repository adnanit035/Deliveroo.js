import {Beliefs} from "./beliefs.js";
import {Intentions} from "./intentions.js";
import {L1Distance} from "../utils/BenchMark.js";
import {onlineSolver, PddlAction, PddlDomain, PddlProblem} from "@unitn-asa/pddl-client";
import fs from "fs";


class Plan {
    /**
     * This class is responsible for computing the plan and storing it in the actionList array.
     * The plan is a sequence of actions that the agent needs to perform to achieve the goal (Intention).
     * The plan is computed using PDDL.
     */

    /**
     * @type {string[]} // list of actions that the agent needs to perform to achieve the goal
     * @example ["pick up", "go to", "put down", "wait", "left", "right", "up", "down"]
     */
    actionList = [];

    /**
     * @param {Intentions} intentions  // sequence of intentions to be achieved by the agent (Intention object)
     * @param {Beliefs} beliefs  // the beliefs of the agent (Beliefs object)
     */
    constructor(intentions, beliefs) {
        this.goal = intentions.getFront(); // get the first intention or attention with the highest priority

        // get all the reachable cells from the current position of the agent (beliefs.agentData)
        // reachable is a matrix of the same size as the city map, where each tile contains the distance from the agent
        let reachable = beliefs.gridMap.getAllReachable(
            beliefs.agentData,  // starting position
            beliefs.agentData,  // ending position
            beliefs.getAgentBeliefs().getPositionsOfAllAgents()  // list of positions of all the agents
        );

        let mapVariables = "";  // list of variables that will be used in PDDL (map variables)
        let mapPredicates = "";  // list of predicates that will be used in PDDL (map predicates)

        // get the list of variables and predicates that will be used in PDDL to generate problem
        // Why need to generate problem? Because the problem is dynamic, it changes every time the agent moves.
        // The problem is generated based on the current state of the agent (beliefs) and the goal (intentions)
        // The problem is generated in PDDL format, which is a string that contains the variables and predicates
        // The problem is generated using the reachable matrix (which contains the distance from the agent to each tile)
        for (let x = 0; x < beliefs.gridMap.getWidth(); x++) {
            for (let y = 0; y < beliefs.gridMap.getHeight(); y++) {
                if (reachable[x][y] >= 0) {
                    mapVariables += `x${x}y${y} `;  // add reachable tile to the list of variables

                    if (x > 0 && reachable[x - 1][y] >= 0) {
                        // add the right neighbor predicate to the string of predicates in PDDL
                        mapPredicates += `(rightNeighbour x${x}y${y} x${x - 1}y${y}) `;
                    }
                    if (x < beliefs.gridMap.getWidth() - 1 && reachable[x + 1][y] >= 0) {
                        // add the left neighbor predicate to the string of predicates in PDDL
                        mapPredicates += `(leftNeighbour x${x}y${y} x${x + 1}y${y}) `;
                    }
                    if (y > 0 && reachable[x][y - 1] >= 0) {
                        // add the up neighbor predicate to the string of predicates in PDDL
                        mapPredicates += `(upNeighbour x${x}y${y} x${x}y${y - 1}) `;
                    }
                    if (y < beliefs.gridMap.getHeight() - 1 && reachable[x][y + 1] >= 0) {
                        // add the down neighbor predicate to the string of predicates in PDDL
                        mapPredicates += `(downNeighbour x${x}y${y} x${x}y${y + 1}) `;
                    }

                    // if the Manhattan distance between the current position
                    // add the predicate to the string of predicates in PDDL
                    if (L1Distance({x: x, y: y}, beliefs.agentData) !== 0) {
                        // mark the tile free to the string of predicates with the position of the tile
                        mapPredicates += `(free x${x}y${y}) `;
                    }

                    // add tile to the string of predicates in PDDL
                    mapPredicates += `(TILE x${x}y${y}) `;
                }
            }
        }

        // get reachable zones from the map
        for (let zone of beliefs.gridMap.getDeliverySpots()) {
            if (reachable[zone.x][zone.y] >= 0) {
                // add delivery zone to the string of predicates in PDDL
                mapPredicates += `(isDeliverySpot x${zone.x}y${zone.y}) `;
            }
        }

        // get agent positions from the map
        let agentPredicates = `(AGENT agent) (onTile agent x${beliefs.agentData.x}y${beliefs.agentData.y}) `;

        // get pkg/parcel positions from the map
        let parcelPredicates = "(PKG pkg) ";

        // define the parcels that are on the ground and the parcels that are in the bag based on the goal of the agent
        if (this.goal.action === "pick up") {
            parcelPredicates += `(notPicked pkg) (onTile pkg x${this.goal.location.x}y${this.goal.location.y}) `;
        } else if (this.goal.action === "put down") {
            parcelPredicates += "(picked pkg) ";
        }

        // define the objective of the agent based on the goal
        let objective = "";
        if (this.goal.action === "pick up") {
            objective = "and (picked pkg) (not (notPicked pkg))";
        } else if (this.goal.action === "put down") {
            objective = `and (notPicked pkg) (onTile pkg x${this.goal.location.x}y${this.goal.location.y}) (not (picked pkg))`;
        } else if (this.goal.action === "go to") {
            objective = `and (onTile agent x${this.goal.location.x}y${this.goal.location.y})`;
        }

        // create the PDDL problem using the variables, predicates, and objective
        let problem = new PddlProblem(
            'deliveroo',  // name of the PDDL problem
            mapVariables + 'agent pkg',  // variables of the agent
            mapPredicates + agentPredicates + parcelPredicates,  // predicates of the agent
            objective  // objective of the agent
        );

        this.pddlProblem = problem.toPddlString();

        // create the PDDL domain using the actions and predicates
        // 1. create the PddlAction objects
        let right = new PddlAction(
            'right',  // name of the action
            '?agent ?from ?to',  // parameters of the action
            'and (AGENT ?agent) (TILE ?from) (TILE ?to) (onTile ?agent ?from) (free ?to) (rightNeighbour ?to ?from)',  // preconditions of the action
            'and (free ?from) (not (free ?to)) (onTile ?agent ?to) (not (onTile ?agent ?from))'  // effects of the action
        );
        let left = new PddlAction(
            'left',  // name of the action
            '?agent ?from ?to',  // parameters of the action
            'and (AGENT ?agent) (TILE ?from) (TILE ?to) (onTile ?agent ?from) (free ?to) (leftNeighbour ?to ?from)',  // preconditions of the action
            'and (free ?from) (not (free ?to)) (onTile ?agent ?to) (not (onTile ?agent ?from))'  // effects of the action
        );
        let up = new PddlAction(
            'up',  // name of the action
            '?agent ?from ?to',  // parameters of the action
            'and (AGENT ?agent) (TILE ?from) (TILE ?to) (onTile ?agent ?from) (free ?to) (upNeighbour ?to ?from)',  // preconditions of the action
            'and (free ?from) (not (free ?to)) (onTile ?agent ?to) (not (onTile ?agent ?from))'  // effects of the action
        );
        let down = new PddlAction(
            'down',  // name of the action
            '?agent ?from ?to',  // parameters of the action
            'and (AGENT ?agent) (TILE ?from) (TILE ?to) (onTile ?agent ?from) (free ?to) (downNeighbour ?to ?from)',  // preconditions of the action
            'and (free ?from) (not (free ?to)) (onTile ?agent ?to) (not (onTile ?agent ?from))'  // effects of the action
        );
        let pick_up = new PddlAction(
            'pick_up',  // name of the action
            '?agent ?pkg ?tile',  // parameters of the action
            'and (AGENT ?agent) (PKG ?pkg) (TILE ?tile) (onTile ?agent ?tile) (onTile ?pkg ?tile) (notPicked ?pkg)',  // preconditions of the action
            'and (not (onTile ?pkg ?tile)) (not (notPicked ?pkg)) (picked ?pkg)'  // effects of the action
        );

        let wait = new PddlAction(
            'wait',  // name of the action
            '?agent ?from',  // parameters of the action
            'and (AGENT ?agent) (TILE ?from) (onTile ?agent ?from)',  // preconditions of the action
            'and (onTile ?agent ?from)'  // effects of the action
        );

        let put_down = new PddlAction(
            'put_down',  // name of the action
            '?agent ?pkg ?tile',  // parameters of the action
            'and (AGENT ?agent) (PKG ?pkg) (TILE ?tile) (onTile ?agent ?tile) (picked ?pkg) (isDeliverySpot ?tile)',  // preconditions of the action
            'and (onTile ?pkg ?tile) (notPicked ?pkg) (not (picked ?pkg))'  // effects of the action
        );

        // 2. create the PddlDomain object
        let domain = new PddlDomain(
            'deliveroo',  // name of the PDDL domain
            right, left,  up, down, pick_up, put_down, wait
        );

        this.pddlDomain = domain.toPddlString();

        // create domain.pddl and problem.pddl files using fs
        // fs.writeFile('domain.pddl', this.pddlDomain, (err) => {
        //     if (err) throw err;
        // });
        // fs.writeFile('problem.pddl', this.pddlProblem, (err) => {
        //     if (err) throw err;
        // });
    }


    /**
     * Call the PDDL API to get the plan and modify the plan structure
     * @param {string} domain
     * @returns {Promise<any>}
     */
    async getPlan(domain) {
        return new Promise((res, rej) => {
            if (this.goal.action === "wait") {
                this.actionList.push("wait");
                this.shortestPath = [];
                res();
            } else {
                onlineSolver(domain, this.pddlProblem).then((pddlSteps) => {
                    if (pddlSteps === undefined) {
                        console.log("planning error: ");
                        rej();
                    } else {
                        this.shortestPath = [];
                        this.actionList = [];
                        for (let step of pddlSteps) {
                            this.actionList.push(step.action);
                            if (step.action == "left" || step.action == "right" || step.action == "up" || step.action == "down") {
                                let nextPos = step.args[2].substring(1);
                                let posSplit = nextPos.split("y");
                                let xCoordString = posSplit[0];
                                let yCoordSplit = posSplit[1];
                                this.shortestPath.push({x: parseInt(xCoordString), y: parseInt(yCoordSplit)});
                            }
                        }
                        res();
                    }
                });
            }
        });
    }

    /**
     * This function checks if the actionList array is an empty array and
     * returns a boolean describing the result
     * @returns {boolean}
     */
    isEmpty() {
        return this.actionList.length == 0;
    }

    /**
     * This function checks if the current plan is sound, which means that
     * the plan makes sense given the current environment and intention.
     * For example, if there is an obstacle that won't move in the next position
     * we want to reach, then the plan is not sound, and this function returns false.
     * @param {Beliefs} beliefs
     * @param {Intentions} intentions
     * @returns {boolean}
     */
    isSound(beliefs, intentions) {
        let boolean_value = true;
        let current_path = JSON.parse(JSON.stringify(this.shortestPath));
        let opponent_agents = beliefs.agentDB.getPositionsOfAllAgents()  // get the positions of all the agents in the map

        let current_intention = intentions.getFront()  // get the current intention of the agent
        if (opponent_agents.length === 0) {
            console.log("No other agents in the map")
        }

        // check if the agent is going to move in the same position of another agent
        while (opponent_agents.length > 0) {
            let opponent = opponent_agents.shift()  // get the first opponent agent in the list
            current_path = JSON.parse(JSON.stringify(this.shortestPath))
            while (current_path.length > 0) {
                let next_astar_pos = current_path.shift()  // get the next position in the path planned by A* algorithm

                // check if the next position is the same of the opponent agent
                if (next_astar_pos.x === opponent.x && next_astar_pos.y === opponent.y) {
                    boolean_value = false
                }
            }
        }

        // get all the parcels on the ground (not in the bag) means free parcels
        let parcels_on_ground = beliefs.getParcelBeliefs().getFreeParcels()

        // check if the agent is going to pick up a parcel that is not on the ground
        if (parcels_on_ground.length === 0 && current_intention.action === "pick up") {
            boolean_value = false
        }

        // check if the agent is going to put down a parcel that is not in the bag or no time left
        let score_parcel = parcels_on_ground.reward  // get the score of the parcel
        let list_of_action = this.actionList.length;
        if (score_parcel < list_of_action) {
            boolean_value = false
        } else boolean_value = true

        return boolean_value
    }

    /**
     * This function takes the first action out from the action_list and returns it.
     * If the action_list is empty, "error" will be returned
     * @returns {string}
     */
    popFront() {
        if (this.isEmpty())
            return "error"
        else
            this.shortestPath.shift()
        return this.actionList.shift()
    }
}

export {Plan}
