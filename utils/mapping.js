import {L1Distance} from "./BenchMark.js";
import {astar, Graph} from "./Search.js";

class GridMap {
    /**
     * @type {[[number]]}
     */
    path_layout = []  // [x][y] 0=wall/obstacle 1=path
    /**
     * @type {[[string]]}
     */
    logical_layout = []  // [x][y] 'E'=empty 'P'=path 'D'=delivery
    /**
     * @type {[{x:number; y:number;}]}
     */
    delivery_spots = []  // x,y of delivery spots
    /**
     * @type {number}
     */
    width = 0
    /**
     * @type {number}
     */
    height = 0

    /**
     * @param {DeliverooApi} client
     */
    constructor(client) {
        this.client = client;
        client.onTile((x, y, is_delivery) => {
            this.updateLayout(x, y, is_delivery)
        })
    }

    /**
     * take x, y corrdinates along with a boolean indicating if the tile is a delivery spot
     *  and update the map accordingly to define delivery spots and paths
     * @param {number} x
     * @param {number} y
     * @param {boolean} is_delivery
     */
    updateLayout(x, y, is_delivery) {
        this.updateWidthAndHeight(x + 1, y + 1);
        this.logical_layout[x][y] = 'P'
        this.path_layout[x][y] = 1
        if (is_delivery) {
            this.delivery_spots.push({x: x, y: y})
            this.logical_layout[x][y] = 'D'
        }
    }

    /**
     * take width and height and update the map accordingly to define the map size
     * @param {number} x
     * @param {number} y
     */
    updateWidthAndHeight(x, y) {
        if (x > this.width) { // if the new x is bigger than the current width
            for (let i = 0; i < x - this.width; i += 1) {
                this.path_layout.push([])  // add a empty row to the path layout
                this.logical_layout.push([])  // add a empty row to the logical layout
            }

            this.width = x;  // update the width of the map
        }

        if (y > this.height) {
            this.height = y;  // update the height of the map
        }

        for (let row of this.path_layout) {
            while (row.length != this.height) {
                row.push(0)  // add walls in the path layout
            }
        }

        for (let row of this.logical_layout) {
            while (row.length != this.height) {
                row.push('E')  // mark the new column as empty in the logical layout
            }
        }
    }

    /**
     * take the current position of the agent and the positions of the other agents and check if the other agents
     * are in the view distance of our agent, and they are not lost then mark them as walls in the path layout. Mean to
     * say that we can not go to the tiles that are occupied by other agents.
     * @param {[{x:number; y:number; is_lost: boolean;}]} agent_positions
     * @param {[{x:number; y:number;}]} my_position
     * @returns {[[number]]}
     */
    getMaskedPathLayout(my_position, agent_positions) {
        let copied_layout = JSON.parse(JSON.stringify(this.path_layout));
        for (let agent of agent_positions) {
            if (agent.x >= this.width || agent.y >= this.height)  // ignore agents in unloaded parts of the map
                continue;

            if (!agent.lost)
                copied_layout[agent.x][agent.y] = 0;
            else {
                // metric to decide about forgetting a far away believed agent
                if (L1Distance(my_position, {x: agent.x, y: agent.y}) <= VIEW_DISTANCE + 5) {
                    copied_layout[agent.x][agent.y] = 0;
                }
            }
        }
        return copied_layout
    }

    /**
     * @returns {[{x: number; y:number;}]}
     */
    getDeliverySpots() {
        return this.delivery_spots
    }

    /**
     *
     * @param {number} center_x
     * @param {number} center_y
     * @returns {{x:number;y:number;} | null}
     */
    findClosestSpotFromCenter(center_x, center_y) {
        let closest_to_center = null
        for (let x = 0; x < this.width; x++) {
            for (let y = 0; y < this.height; y++) {
                if (this.path_layout[x][y] !== 0 && (closest_to_center === null ||
                    L1Distance({x: center_x, y: center_y}, {x: x, y: y}) <
                    L1Distance({x: center_x, y: center_y}, {x: closest_to_center.x, y: closest_to_center.y}))) {
                    closest_to_center = {x: x, y: y}
                }
            }
        }
        return closest_to_center
    }

    /**
     *
     * @returns {number}
     */
    getWidth() {
        return this.width;
    }

    /**
     *
     * @returns {number}
     */
    getHeight() {
        return this.height;
    }

    /**
     * get the most optimal path from the starting position of the agent to the ending position of the intention.
     * It uses the A* algorithm to find the optimal path.
     *
     * @param {{x: number; y: number;}} my_position
     * @param {[{x:number; y:number; is_lost: boolean;}]} agent_positions
     * @param {{x:number;y:number;} } start
     * @param {{x:number;y:number;} } end //is basically is the position of intention
     */
    getPath(start, end, my_position, agent_positions) {
        let map = this.getMaskedPathLayout(my_position, agent_positions);  // get the path layout with other agents as walls
        let graph = new Graph(map);  // create a graph from the path layout
        let starting_pos = graph.grid[start.x][start.y]  // get the starting position of my agent on the map
        let ending_pos = graph.grid[end.x][end.y]  // get the ending position of the intention of my agent on the map

        // find the optimal path from the starting position to the ending position
        return astar.search(graph, starting_pos, ending_pos)
    }

    /**
     * get the most optimal path from the starting position of parcel (which is the current intention of my agent) to
     * the ending position of the delivery spot. It uses the A* algorithm to find the optimal path.
     * This time we do not consider the other agents as obstacles.
     *
     * @param {{x:number;y:number;} } start  // parcel position
     * @param {{x:number;y:number;} } end  // delivery spot position
     */
    getPathIgnoringAgents(start, end) {
        let map = this.path_layout
        let graph = new Graph(map);
        let starting_pos = graph.grid[start.x][start.y]
        let ending_pos = graph.grid[end.x][end.y]
        return astar.search(graph, starting_pos, ending_pos)
    }

    /**
     * get all the reachable tiles from the starting position of my agent and other agents positions to consider them
     * as obstacles. The reachable tiles are the tiles that are not walls and are not occupied by other agents.
     * This is done by using BFS algorithm to find the shortest path from the starting position to all the other tiles
     * in the map.
     * @param {{x:number;y:number;} } start
     * @param {{x: number; y: number;}} my_position
     * @param {[{x:number; y:number; is_lost: boolean;}]} agent_positions
     */
    getAllReachable(start, my_position, agent_positions) {
        let masked = this.getMaskedPathLayout(my_position, agent_positions)  // get masked path layout/obstacles
        let reachability = []

        // initialize the reachability matrix
        for (let i = 0; i < masked.length; i++) {
            reachability.push(masked[i].map((v) => {
                return v + this.getHeight() * this.getWidth()
            }))
        }

        // initialize the queue with the starting position and set its reachability to 0
        let queue = [{x: start.x, y: start.y}]
        reachability[start.x][start.y] = 0

        // calculate the reachability of all the tiles in the map using BFS
        while (!queue.length == 0) {
            let current = queue.shift()
            let current_weight = reachability[current.x][current.y]
            // for each of the four directions
            for (let shift of [{x: 0, y: 1}, {x: 1, y: 0}, {x: -1, y: 0}, {x: 0, y: -1}]) {
                // calculate the next coordinate
                let next = {x: current.x + shift.x, y: current.y + shift.y}

                // if the next coordinate is inside the bounds of the map and is not an obstacle
                if (next.x >= 0 && next.y >= 0 && next.x < this.getWidth() && next.y < this.getHeight() && masked[next.x][next.y] != 0) {
                    let next_weight = reachability[next.x][next.y]
                    if (next_weight > current_weight + 1) {
                        reachability[next.x][next.y] = current_weight + 1
                        queue.push({x: next.x, y: next.y})
                    }
                }
            }
        }

        // set the reachability of all the unreachable tiles to -1
        for (let i = 0; i < masked.length; i++) {
            reachability[i] = reachability[i].map((v) => {
                if (v >= this.getHeight() * this.getWidth()) {
                    return -1
                }
                return v
            })
        }
        return reachability
    }
}


export {GridMap}