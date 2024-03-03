import * as constants from "./ConsVar.js";
import {L1Distance} from "./BenchMark.js";

// maximum numbers of tiles the agent can see from itself
const VIEW_DISTANCE = constants.VIEW_DISTANCE;


class ParcelsDB {
    /**
     * @type {Map<string, {id: string; x: number; y: number; carriedBy: string; reward: number;}>}
     */
    database = new Map();
    /**
     * @type {[{id: string; x: number; y: number; carriedBy: string; reward: number;}]}
     */
    last_update = []

    /**
     * @param {DeliverooApi} client
     */
    constructor(client) {
        this.client = client;
        client.onParcelsSensing((parcels) => {
            this.updateParcelsData(parcels)
        })
    }

    /**
     * @param {[{id: string; x: number; y: number; carriedBy: string; reward: number;}]} parcels
     */
    updateParcelsData(parcels) {
        this.last_update = parcels;
        for (const parcel of parcels) {
            if (parcel.x % 1 != 0 || parcel.y % 1 != 0) continue;// skip buggy parcels
            if (!this.database.has(parcel.id)) { // new parcel discovered
                if (parcel.carriedBy === null) { // dont care about parcels that have already been picked up
                    this.database.set(parcel.id, parcel)
                }
            } else { // old parcel to update
                this.database.set(parcel.id, parcel)
            }
        }
    }

    /**
     * @param {{x: number; y: number;}} my_data
     */
    updateLostParcels(my_data) {
        let update_ids = this.last_update.map(p => p.id);
        for (let [id, data] of this.database) {
            if (!update_ids.includes(id)) {
                if (L1Distance(my_data, data) <= VIEW_DISTANCE) { // if a parcel I should be able to see has disappeared forget it
                    this.database.delete(id)
                }
            }
        }
    }

    /**
     * @param {number} id
     * @returns {{id: string; x: number; y: number; carriedBy: string; reward: number;} | null}
     */
    getParcelFromId(id) {
        if (!this.database.has(id)) {
            return null;
        }
        const parcel = this.database.get(id)
        return parcel
    }

    /**
     * @returns {[{id: string; x: number; y: number; carriedBy: string; reward: number;}]}
     */
    getAllParcels() {
        let acc = []
        for (const [id, _data] of this.database) {
            let parcel_data = this.getParcelFromId(id)
            if (parcel_data !== null) {
                acc.push(parcel_data)
            }
        }
        return acc;
    }

    /**
     * @returns {[{id: string; x: number; y: number; carriedBy: string; reward: number;}]}
     */
    getFreeParcels() {
        let p = this.getAllParcels()
        p = p.filter(item => !item.carriedBy)
        return p;
    }

    /**
     * @param {{id:string;}} my_data
     */
    getMyBag(my_data) {
        let p = this.getAllParcels()
        let filtered = p.filter(item => (item.carriedBy === my_data.id))
        return filtered;
    }
}

export {ParcelsDB};
