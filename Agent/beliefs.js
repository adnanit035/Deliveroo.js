import {AgentsDB} from "../utils/AgentSense.js";
import {ParcelsDB} from "../utils/ParcelSense.js";
import {GridMap} from "../utils/mapping.js";

class Beliefs {
    /**
     * This class is used to store the beliefs of the agent. It is used by the agent to formulate its desires
     * and to update its beliefs based on the percepts it receives from the environment (e.g. the agent's position, the parcels on the ground etc)
     * @param {DeliverooApi} client
     * @param {GridMap} gridMap
     * @param {{x: number; y: number; id: string; score: number; name: string;}} me
     */
    constructor(client, gridMap, me) {
        this.client = client;
        this.gridMap = gridMap;
        this.agentData = me;
        this.agentDB = new AgentsDB(client);
        this.parcelDB = new ParcelsDB(client);
        this.explorationSpots = new Map();
    }

    // The agent believes these are the spots it needs to reach in order to explore the map
    loadExplorationSpots() {
        /**
         * Loads the exploration spots of the agent. As the agent believes these are the spots it needs to reach in order to explore the map
         */

        // Set the exploration spots of the agent to the closest spots to the center of the map
        // and the closest spots to the center of each side of the map
        this.explorationSpots.set(
            "center",
            this.gridMap.findClosestSpotFromCenter(
                Math.trunc(this.gridMap.getWidth() / 2),
                Math.trunc(this.gridMap.getHeight() / 2)
            )
        );

        // Set the exploration spots of the agent to north, south, west, east, northeast, northwest, southeast, southwest
        // 1. North
        this.explorationSpots.set(
            "n",
            this.gridMap.findClosestSpotFromCenter(
                Math.trunc(this.gridMap.getWidth() / 2),
                Math.trunc((this.gridMap.getHeight() * 3) / 4)
            )
        );

        // 2. South
        this.explorationSpots.set(
            "s",
            this.gridMap.findClosestSpotFromCenter(
                Math.trunc(this.gridMap.getWidth() / 2),
                Math.trunc(this.gridMap.getHeight() / 4)
            )
        );

        // 3. West
        this.explorationSpots.set(
            "w",
            this.gridMap.findClosestSpotFromCenter(
                Math.trunc(this.gridMap.getWidth() / 4),
                Math.trunc(this.gridMap.getHeight() / 2)
            )
        );

        // 4. East
        this.explorationSpots.set(
            "e",
            this.gridMap.findClosestSpotFromCenter(
                Math.trunc((this.gridMap.getWidth() * 3) / 4),
                Math.trunc(this.gridMap.getHeight() / 2)
            )
        );

        // 5. Northeast
        this.explorationSpots.set(
            "ne",
            this.gridMap.findClosestSpotFromCenter(
                Math.trunc((this.gridMap.getWidth() * 3) / 4),
                Math.trunc((this.gridMap.getHeight() * 3) / 4)
            )
        );

        // 6. Northwest
        this.explorationSpots.set(
            "se",
            this.gridMap.findClosestSpotFromCenter(
                Math.trunc(this.gridMap.getWidth() / 4),
                Math.trunc((this.gridMap.getHeight() * 3) / 4)
            )
        );

        // 7. Southeast
        this.explorationSpots.set(
            "nw",
            this.gridMap.findClosestSpotFromCenter(
                Math.trunc((this.gridMap.getWidth() * 3) / 4),
                Math.trunc(this.gridMap.getHeight() / 4)
            )
        );

        // 8. Southwest
        this.explorationSpots.set(
            "sw",
            this.gridMap.findClosestSpotFromCenter(
                Math.trunc(this.gridMap.getWidth() / 4),
                Math.trunc(this.gridMap.getHeight() / 4)
            )
        );
    }

    /**
     * This function returns a reference to the beliefs agents in the environment and our agent's beliefs about them
     * @returns {AgentsDB}
     */
    getAgentBeliefs() {
        return this.agentDB;
    }

    /**
     * This function returns a reference to the beliefs parcels in the environment and our agent's beliefs about them
     * @returns {ParcelsDB}
     */
    getParcelBeliefs() {
        return this.parcelDB;
    }
}

export {Beliefs};
