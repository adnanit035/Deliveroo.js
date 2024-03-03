import * as constants from "./ConsVar.js";
import {L1Distance} from "./BenchMark.js";

// Define constants
const SIZE_LIMIT = constants.MEMORY_SIZE_LIMIT; // Maximum number of history events recorded for each agent
const VIEW_DISTANCE = constants.VIEW_DISTANCE; // Maximum number of tiles the agent can see from itself
const LOST = constants.LOST; // Annotation to indicate that an agent is lost

class AgentsDB {
    // Database to store agent information
    /**
     * @type {Map<string, [{id: string; name: string; x: number; y: number; score: number;} | string]>}
     */
    database = new Map();

    // Store the last updated agent data
    /**
     * @type {[{id: string; name: string; x: number; y: number; score: number;}]}
     */
    last_update = [];

    /**
     * @param {DeliverooApi} client
     */
    constructor(client) {
        this.client = client;
        // Set up event listener for agent sensing
        client.onAgentsSensing((agents) => {
            this.updateAgentsData(agents);
        });
    }

    /**
     * Update the agent data in the database
     * @param {[{id: string; name: string; x: number; y: number; score: number;}]} agents
     */
    updateAgentsData(agents) {
        this.last_update = agents;
        for (const agent of agents) {
            // Round the x and y coordinates
            agent.x = Math.round(agent.x);
            agent.y = Math.round(agent.y);

            if (!this.database.has(agent.id)) { // New agent discovered
                this.database.set(agent.id, [agent]);
            } else { // Existing agent to update
                let knowledge = this.database.get(agent.id);
                knowledge.push(agent);

                if (knowledge.length > SIZE_LIMIT) { // Limit the size of beliefs by removing the oldest point
                    knowledge.shift();
                }
            }
        }
    }

    /**
     * Update the lost agents in the database
     * @param {{x: number; y: number;}} my_data
     */
    updateLostAgents(my_data) {
        let update_ids = this.last_update.map((a) => a.id);

        for (let [id, knowledge] of this.database) {
            const latest = knowledge[knowledge.length - 1];

            if (!update_ids.includes(id) && latest !== LOST) {
                if (L1Distance(my_data, latest) <= VIEW_DISTANCE) { // Condition to consider a not lost agent as lost
                    knowledge.push(LOST);

                    if (knowledge.length > SIZE_LIMIT) { // Limit the size of beliefs by removing the oldest point
                        knowledge.shift();
                    }
                }
            }
        }
    }

    /**
     * Get the position of an agent
     * @param {number} id
     * @returns {{x: number; y:number; is_lost: boolean;} | null}
     */
    getPositionOfAgent(id) {
        if (!this.database.has(id)) {
            return null;
        }

        const knowledge = this.database.get(id);
        const latest = knowledge[knowledge.length - 1];

        if (latest === LOST) {
            const second_latest = knowledge[knowledge.length - 2];
            return {x: second_latest.x, y: second_latest.y, is_lost: true};
        }

        return {x: latest.x, y: latest.y, is_lost: false};
    }

    /**
     * Get the positions of all agents
     * @returns {[{x: number; y:number; is_lost: boolean;}]}
     */
    getPositionsOfAllAgents() {
        let acc = [];

        for (const [id, _know] of this.database) {
            let latest_position = this.getPositionOfAgent(id);

            if (latest_position !== null) {
                acc.push(latest_position);
            }
        }

        return acc;
    }
}

export {AgentsDB};
