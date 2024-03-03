class Desire {
    /**
     * Desire class that represents a desire object of the agent to do something at a specific location
     * @param {number} x  x coordinate of the location
     * @param {number} y  y coordinate of the location
     * @param {string} action  the action to do at the location (e.g. go to, pick up, put down)
     * @param {object} parcel  the parcel object (optional, only applicable for "pick up" action)
     */
    constructor(x, y, action, parcel = null) {
        /**
         * constructor of the Desire class that represents a desire of the agent to do something at
         * a specific location (x,y) with a specific action (action) and a specific parcel (parcel)
         * the action to do at the location (e.g. go to, pick up, put down)
         * @type {{x: number, y: number}}
         */
        this.location = { x: x, y: y };  // location of the desire

        // action to do at the location (e.g. go to, pick up, put down)
        if (action === "pick up" || action === "go to" || action === "put down") {
            this.action = action;
        }

        if (this.action === "pick up") {
            this.parcel = parcel;
        }
    }
}

class Desires {
    /**
     * Desires class that represents the desires of the agent to do something at a specific location (e.g. go to, pick up, put down etc)
     * It is basically a list of Desire objects defined above
     * @type {[Desire]}
     */
    possibilities = [];

    constructor(beliefs) {
        /**
         * takes the beliefs of the agent and creates a list of possible desires
         */
        // get the parcels on the ground and the parcels in the bag
        let parcelsOnGround = beliefs.getParcelBeliefs().getFreeParcels();

        // get the parcels in the bag of the agent (agentData)
        let bag = beliefs.getParcelBeliefs().getMyBag(beliefs.agentData);

        // add the possible desires to the list of possibilities of the agent
        for (let spot of beliefs.explorationSpots.values()) {
            this.possibilities.push(new Desire(spot.x, spot.y, "go to"));  // go to the exploration spots
        }

        for (let parcel of parcelsOnGround) {
            this.possibilities.push(new Desire(parcel.x, parcel.y, "pick up", parcel));  // pick up the parcels on the ground
        }

        if (bag.length > 0) {  // if the agent has parcels in the bag
            for (let zone of beliefs.gridMap.delivery_spots) {
                this.possibilities.push(new Desire(zone.x, zone.y, "put down"));  // put down the parcels on the delivery spots
            }
        }
    }
}

export { Desire, Desires };
