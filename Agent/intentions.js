import { L1Distance } from "../utils/BenchMark.js";
import { Beliefs } from "./beliefs.js";
import { Desires } from "./desires.js";

class Intention {
    /**
     * This class represents an intention to achieve a certain action in a certain location with certain args [parcel_id]
     * @param {number} x  // x coordinate of the location where the action should be performed
     * @param {number} y  // y coordinate of the location where the action should be performed
     * @param {string} action  // the action to perform
     * @param {string[]} args  // arguments referring to the parcel id (if any)
     */
    constructor(x, y, action, args) {
        /**
         * constructor of the Intention class that represents an intention to achieve a certain action in a certain location with certain args [parcel_id]
         * @type {{x: number, y: number}}
         */
        this.location = { x: x, y: y };  // x,y coordinates of the location where the action should be performed
        this.args = args;  // arguments referring to the parcel id (if any)

        // the action to perform (pick up, go to, put down, wait)
        if (action === "pick up" || action === "go to" || action === "put down" || action === "wait") {
            this.action = action;  // set the action
        }
    }
}

class Intentions {
    /**
     * This class represents the intentions of the agent -> contains a list of intentions (Intention class)
     * @type {Intention[]}
     */
    intentions = [];  // list of intentions (Intention class)

    /**
     * @type {Beliefs}
     */
    beliefs;

    /**
     * @param {Beliefs} beliefs
     */
    constructor(beliefs) {
        /**
         * constructor of the Intentions class that represents the intentions of the agent -> contains a list of intentions (Intention class)
         * @type {Beliefs}
         */
        this.beliefs = beliefs;
        this.intentions = [];
    }

    /**
     * filter function takes the desires of the agent and filters them based on the agent's beliefs
     * @param {Desires} desires  // the desires of the agent (Desires class)
     * @param {boolean} changeIntention  // if true, the agent will change its current intention to the 2nd best intention
     */
    filter(desires, changeIntention = false) {
        this.intentions = [];
        let me = this.beliefs.agentData;  // get the agent's data

        // get the reachability map of the agent
        let reachabilityMap = this.beliefs.gridMap.getAllReachable(me, me,
            this.beliefs.getAgentBeliefs().getPositionsOfAllAgents());

        // filter the desires based on the reachability map by removing the desires that are not reachable
        desires.possibilities = desires.possibilities.filter((v) => {
            // if the location is reachable return true (keep the desire)
            // by checking if the reachability map has a value >= 0 (not -1: unreachable and not 0: not walls)
            return reachabilityMap[v.location.x][v.location.y] >= 0;
        });

        if (desires.possibilities.length === 0) {  // if there are no desires left then wait
            // If I cannot do anything I wait 2 seconds and retry later
            this.intentions.push(new Intention(me.x, me.y, "wait", [2000]));
            return;
        }

        let bag = this.beliefs.getParcelBeliefs().getMyBag(me);  // get the parcels in the agent's bag
        let bagScore = 0;
        for (let parcel of bag) {
            bagScore += parcel.reward;  // compute the score of the parcels in the bag (sum of the rewards)
        }

        // map every desire into a possible Intention
        let intentionsFromDesires = desires.possibilities.map((desire) => {
            if (desire.action === "pick up") {
                return new Intention(desire.location.x, desire.location.y, "pick up", [desire.parcel.id]);
            }

            if (desire.action === "put down") {
                return new Intention(desire.location.x, desire.location.y, "put down", []);
            }

            if (desire.action === "go to") {
                return new Intention(desire.location.x, desire.location.y, "go to", []);
            }

            return new Intention(me.x, me.y, "go to", []);
        });

        // compute the score of each intention
        let utilities = intentionsFromDesires.map((intention) => {
            return this.utility(intention, bagScore, bag.length);
        });

        // take intention with the highest score
        let bestUtility = Math.max(...utilities);

        if (changeIntention) {
            // take intention with the second-highest score
            let secondBestUtility = Math.max(...utilities.filter((v) => {
                return v !== bestUtility;
            }));

            // add the intention with the second-highest score to the intentions array
            for (let i = 0; i < intentionsFromDesires.length; i++) {
                if (utilities[i] === secondBestUtility) {
                    console.log('changing intention...');
                    this.intentions.push(intentionsFromDesires[i]);
                    return;
                }
            }
        }

        // add the intention with the highest score to the intentions array
        for (let i = 0; i < intentionsFromDesires.length; i++) {
            if (utilities[i] === bestUtility) {
                this.intentions.push(intentionsFromDesires[i]);
                return;
            }
        }
    }

    /**
     * function to return first intention in the intentions array
     * @returns {Intention | null}
     */
    getFront() {
        if (this.intentions.length > 0) {
            return this.intentions[0];
        } else {
            return null;
        }
    }

    /**
     * Function to check if the current intention is succeeded
     * @returns {boolean}
     */
    hasSucceeded() {
        let current = this.getFront();
        if (current === null) {
            return true;
        }
        let me = this.beliefs.agentData;  // get the agent's data
        if (L1Distance(me, current.location) > 0) { // if the agent is not at the location of the intention
            return false;
        }
        if (current.action === "go to") {  // if the action is go to, then the intention is succeeded
            return true;
        }
        if (current.action === "pick up") {  // if the action is pick up, then the intention is succeeded if the agent has the parcel in its bag
            let parcelId = current.args[0];  // get the parcel id from the intention
            let parcelData = this.beliefs.getParcelBeliefs().getParcelFromId(parcelId);  // get the parcel data from the parcel id
            if (!parcelData) {  // if the parcel data is null, then the parcel is not in the agent's bag
                return false;
            }
            if (parcelData.carriedBy === me.id) {  // if the parcel is in the agent's bag, then the intention is succeeded
                return true;
            }
        }

        if (current.action === "put down") {  // if the action is put down, then the intention is succeeded if the agent has no parcels in its bag
            let myBag = this.beliefs.getParcelBeliefs().getMyBag(me);  // get the parcels in the agent's bag
            if (myBag.length === 0) {  // if the agent has no parcels in its bag, then the intention is succeeded
                return true;
            }
        }
        return false;
    }

    /**
     * function to check if the current intention is feasible (possible) or not
     * @returns {boolean}
     */
    isImpossible() {
        let current = this.getFront();  // get the current intention
        if (current === null) {
            return false;  // if there is no intention, then it is not impossible
        }

        let me = this.beliefs.agentData;  // get the agent's data
        if (L1Distance(me, current.location) === 0) {   // if distance between agent and intention is 0
            if (current.action === "pick up") {  // if the action is pick up
                let parcel = this.beliefs.getParcelBeliefs().getParcelFromId(current.args[0]);  // get the parcel data from the parcel id
                if (L1Distance(me, parcel) === 0 && !parcel.carriedBy) {  // if the parcel is at the same location as the agent and is not carried by any agent
                    return false;  // then the intention is feasible
                } else {
                    return true;  // else the intention is not feasible
                }
            }
            if (current.action === "put down") {  // if the action is put down
                let deliveryZones = this.beliefs.gridMap.getDeliverySpots();  // get the delivery zones
                for (let zone of deliveryZones) {
                    if (L1Distance(me, zone) === 0) {  // if the agent is at a delivery zone
                        return false;  // then the intention is feasible
                    }
                }
                return true;  // else the intention is not feasible
            }
            return false;  // else the intention is feasible
        } else {  // if distance between agent and intention is not 0
            // ...
        }
    }

    /**
     * Function to check if the current intention is still relevant or not (if the agent has a better option)
     * @returns {boolean}
     */
    reconsider() {
        let current = this.getFront()  // get the current intention
        if (current === null)  // if there is no intention, then it is not relevant
            return true
        let me = this.beliefs.agentData  // get the agent's data
        let reachability_map = this.beliefs.gridMap.getAllReachable(me, me, this.beliefs.getAgentBeliefs().getPositionsOfAllAgents())

        let bag = this.beliefs.getParcelBeliefs().getMyBag(me)  // get the parcels in the agent's bag

        let bag_score = 0
        for (let p of bag) {  // calculate the score of the parcels in the agent's bag
            bag_score += p.reward;
        }

        let new_parcels = this.beliefs.getParcelBeliefs().getFreeParcels()  // get the new free parcels

        /**  @type {[Intention]} */
        let new_intentions = []

        for (let p of new_parcels) {
            if (reachability_map[p.x][p.y] >= 0) {  // if the parcel is reachable
                new_intentions.push(new Intention(p.x, p.y, "pick up", [p.id]))  // add the intention to pick up the parcel
            }
        }

        if (bag_score > 0) {
            for (let zone of this.beliefs.gridMap.getDeliverySpots()) {  // for each delivery zone
                if (reachability_map[zone.x][zone.y] >= 0) {
                    new_intentions.push(new Intention(zone.x, zone.y, "put down", []))  // add the intention to put down the parcel
                }
            }
        }
        let old_best = this.utility(current, bag_score, bag.length)  // calculate the utility of the current intention
        let new_best = Math.max.apply(new_intentions.map(intention => {  // calculate the utility of the new intentions
            this.utility(intention, bag_score, bag.length)
        }))

        // If I find an Intention with better utility then the current one, I should reconsider my intentions
        return old_best < new_best
    }

    /**
     * Function to calculate the utility of an intention given the agent's bag score and size
     * @param {Intention} option
     * @param {number} bag_score
     * @param {number} bag_size
     * @returns {number}
     */
    utility(option, bag_score, bag_size) {
        let me = this.beliefs.agentData  // get the agent's data
        if (option.action == "go to") {  // if the action is go to
            return L1Distance(me, option.location)  // return the distance between the agent and the intention
        }

        if (option.action == "pick up") {  // if the action is pick up
            let delivery_zones = this.beliefs.gridMap.getDeliverySpots();  // get the delivery zones
            let parcel = this.beliefs.getParcelBeliefs().getParcelFromId(option.args[0])  // get the parcel data
            if (parcel === null)  // if the parcel data is null, then return -1 BCZ it is expired or picked up by another agent
                return -1;

            // get the most optimal path to the current intention which is picked up/means parcel to pick up
            let parcel_distance = this.beliefs.gridMap.getPath(
                me, option.location, me, this.beliefs.getAgentBeliefs().getPositionsOfAllAgents()).length

            // calculate the utility of between the parcel and the delivery zones by considering
            // the travel distance from the parcel to the delivery zone and from the agent to the parcel
            return Math.max.apply(null, delivery_zones.map(zone => {
                let delivery_distance = this.beliefs.gridMap.getPathIgnoringAgents(parcel, zone).length
                let travel_distance = delivery_distance + parcel_distance
                let actual_reward = parcel.reward - delivery_distance
                return 100 * (actual_reward + Math.max(bag_score - (bag_size * travel_distance), 0))
            }))
        }

        if (option.action == "put down") {
            let agents_positions = this.beliefs.getAgentBeliefs().getPositionsOfAllAgents()
            let delivery_distance = this.beliefs.gridMap.getPath(me, option.location, me, agents_positions).length
            return 100 * (bag_score - (bag_size * delivery_distance))
        }
        return 0;
    }
}

export {Intention, Intentions}