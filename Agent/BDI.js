import {GridMap} from "../utils/mapping.js";
import {Beliefs} from "./beliefs.js";
import {Desires} from "./desires.js";
import {Intentions} from "./intentions.js";
import {Plan} from "./plan.js";
import {promises as fs} from "fs"; // File system module

const friend = 'dea14d0a148'; // Set this to the id of the agent you want to be friends with

/**
 * Read file from path and return the data
 * @param path
 * @returns {Promise<string>}
 */
async function readFile(path) {
    try {
        return await fs.readFile(path, 'utf8');
    } catch (err) {throw err;}
}

class Agent {
    /**
     * Class to represent the agent and its components (beliefs, desires, intentions, plan)
     * It also contains the data of the agent (e.g. its id, its score, its name etc.)
     * @type {{x: number; y: number; id: string; score: number; name: string;}}
     */
    agentData = {};

    constructor(client) {
        this.client = client; // Deliveroo API client
        this.gridMap = new GridMap(this.client); // Grid map object
        this.beliefs = new Beliefs(this.client, this.gridMap, this.agentData); // Beliefs object (contains the beliefs' database)
        this.intentions = new Intentions(this.beliefs); // Intentions object (contains the intentions queue)

        // Getting the agent's data from the environment using socket.io events
        this.client.onYou((me) => {
            this.agentData.x = Math.round(me.x); // Get x coordinate position of the agent from its data
            this.agentData.id = me.id; // Get the agent's id from its data
            this.agentData.y = Math.round(me.y); // Get y coordinate position of the agent from its data
            this.agentData.score = me.score; // Get the agent's score that it has collected by delivering parcels
            this.agentData.name = me.name; // Get the agent's name
            this.beliefs.getAgentBeliefs().updateLostAgents(this.agentData); // Update the agent's database in the beliefs
            this.beliefs.getParcelBeliefs().updateLostParcels(this.agentData); // Update the parcels' database in the beliefs
        });
    }

    async start() {
        this.domain = await readFile("./domain.pddl"); // Load the PDDL domain file
        this.beliefs.loadExplorationSpots();
        console.log("\n///////////..........Loading map............../////////\n");
        for (let spots of this.beliefs.explorationSpots.values()) {
            if (spots === null) {
                console.error(
                    "Error: Map spots aren't loaded.\n" +
                    "Check your connection with the server is it working? "
                );
                process.exit(1);
            }
        }
        console.log(
            "\n////////.............Map is Loaded...now its start Behaving...............///////////\n"
        );

        // Get agent's desires based on its beliefs (e.g. parcels, opponents agents, destination spots, etc. in the environment)
        let desires = new Desires(this.beliefs);
        this.intentions.filter(desires); // Filter the desires based on the intentions of the agent

        // Generating a Planning
        // 1. Set the plan based on the intentions and beliefs of the agent
        this.plan = new Plan(this.intentions, this.beliefs);

        // 2. Get the plan based on the PDDL domain and problem
        this.plan
            .getPlan(this.domain)
            .then(() => {
                this.bdiControlLoop(); // Start the BDI control loop
            })
            .catch(() => {
                this.start();
            });

        // #############################################################################################################
        // ############################ Part-2: Communication Between Friends Agents ###################################
        // ############################WWWWWW###########################################################################
        // Idea: The agent sends its data to its friend agent and receives its data in return
        /**
         * A) Agent Sends: Its data, its next intention target, the parcels and the opponents agents in the environment
         */
        // Using Deliveroo API socket.io event to perform the communication
        this.client.onYou((me) => {
            // 1. Getting next intention target of this agent
            let nextIntentionTarget = this.intentions.getFront().args;
            if (nextIntentionTarget.length === 0) {
                nextIntentionTarget = null;
            } else {
                nextIntentionTarget = nextIntentionTarget[0];
            }

            // 2. Getting free parcels from the environment from this agent's beliefs
            let parcelsInEnv = this.beliefs.getParcelBeliefs().getFreeParcels();
            if (parcelsInEnv === null || parcelsInEnv.length === 0) {
                parcelsInEnv = null;
            }

            // 3. Getting opponents agents from the environment from this agent's beliefs
            // 3.1: Getting agents database from the beliefs
            let agentsDB = this.beliefs.getAgentBeliefs().database; // Get the agents database from the beliefs

            // 3.2: Getting the opponents agents from the agents database by skipping the friend agent
            let sensedOpponentAgents = []; // List to store opponents agents in the environment
            for (const [id, _know] of agentsDB) {
                if (id === friend) {
                    // Skip the friend
                    continue;
                }
                // Get the top element from _know
                let lastSeen = _know[_know.length - 1];

                // Create an object with the opponents data
                let agent = {
                    id: id,
                    name: lastSeen.name,
                    position: [lastSeen.x, lastSeen.y],
                    score: lastSeen.score,
                };
                sensedOpponentAgents.push(agent);
            }

            // Create an environment data object by combining the parcels and the opponents agents in the environment
            // this agent's senses in the environment
            let envData = {
                parcels: parcelsInEnv,
                opponentsAgents: sensedOpponentAgents,
            };

            // 4. Creating a single object with all the data to be sent
            let agentDataStr = {
                agentData: this.agentData,
                nextIntentionTarget: nextIntentionTarget,
                envData: envData,
            };

            // Convert key-value array into JSON string
            agentDataStr = JSON.stringify(agentDataStr);

            // 5. Sending agent info to friend agent in JSON format
            this.client.say(friend, agentDataStr);
        });

        /**
         * B) Receiving message from friend agent
         * Receiving Message Data:
         * 1. Friend agent's data (id, name, position, score)
         * 2. Friend agent's next intention target (parcel id)
         * 3. Friend agent's environment data
         * 3.1: Friend agent's parcels in the environment
         * 3.2: Friend agent's opponents agents in the environment
         *
         * Action on Receiving Message:
         * One of the Agent will change its next intention target if both agents have the same intention
         * 1. If both agents have the same intention then one agent will change its intention and re-plan
         */
        this.client.onMsg(async (id, name, msg) => {
            // Parsing the JSON message received from the friend agent
            msg = JSON.parse(msg);
            let friendData = msg.agentData;
            let friendNextIntentionTarget = msg.nextIntentionTarget;
            let friendEnvData = msg.envData;

            // Printing friend agent data
            console.log("\n//////Friend Agent Data////////");
            console.log("Friend ID: ", id);
            console.log("Friend Name: ", name);
            console.log("Location: ", friendData.x, friendData.y);
            console.log("Score: ", friendData.score);

            // Printing friend agent environment data
            console.log("\n//////Friend Environment Data////////");
            console.log("Parcels Data: ", friendEnvData.parcels);
            console.log("\nOpponents Agents Data: ", friendEnvData.opponentsAgents);

            // Printing friend agent next intention target
            console.log("\n//////Friend Next Intention of Parcel Picking////////");
            console.log("Friend's Next Parcel Intention: ", friendNextIntentionTarget);

            // printing own agent data
            console.log("\n//////My Agent Data////////");
            console.log("My ID: ", this.agentData.id);
            console.log("My Name: ", this.agentData.name);
            console.log("Location: ", this.agentData.x, this.agentData.y);
            console.log("Score: ", this.agentData.score);

            // Printing this agent intention target
            console.log("\n//////My Next Intention of Parcel Picking////////");
            console.log("My Next Parcel Intention: ", this.intentions.getFront().args);

            // ########################################################################################################
            // ############################ Action: Changing Intention Target #########################################
            // ########################################################################################################
            // Checking if the friend agent has the same intention target as this agent and it's not null
            let myNextIntentionTarget = this.intentions.getFront().args;
            if (myNextIntentionTarget.length === 0) {
                myNextIntentionTarget = null;
            } else {
                myNextIntentionTarget = myNextIntentionTarget[0];
            }

            if (
                friendNextIntentionTarget !== null &&
                myNextIntentionTarget !== null &&
                myNextIntentionTarget === friendNextIntentionTarget
            ) {
                console.log(
                    "\n!!!!!We both friends have the same intention, so I'm going to change my intention!!!!!"
                );

                // Changing the intention target of this agent to avoid collision with friend agent's intention target
                let desires = new Desires(this.beliefs); // Reconsider the desires
                let changeIntention = true; // To change the intention target

                this.intentions.filter(desires, changeIntention); // Filter the intentions and change the intention target

                // Printing the updated intention and its plan
                console.log("\n////// My Updated Intention////////");
                console.log("My New Intention: ", this.intentions.getFront().args);
            }
        });
    }

    /**
     * Recursive BDI Control Loop function of the agent to sense the environment and act accordingly
     */
    async bdiControlLoop() {
      // Sensing the environment: 1. parcels, 2. agents
      // 1. Parcels
      this.client.onParcelsSensing((parcels) => {
          this.beliefs.getParcelBeliefs().updateParcelsData(parcels);
          this.beliefs.getParcelBeliefs().updateLostParcels(this.beliefs.agentData);
      });

      // 2. Agents
      this.client.onAgentsSensing((agents) => {
          this.beliefs.getAgentBeliefs().updateAgentsData(agents);
          this.beliefs.getAgentBeliefs().updateLostAgents(this.beliefs.agentData);
      });

      // Executing the plan if the plan is not empty and the intentions have not succeeded and not impossible
      if (
          !this.plan.isEmpty() &&
          !this.intentions.hasSucceeded() &&
          !this.intentions.isImpossible()
      ) {
          let action = this.plan.popFront(); // Pop the first action from the plan
          let status = await this.execute(action); // Execute the action

          if (!status) {
              // If the action is not executed successfully
              this.plan = new Plan(this.intentions, this.beliefs); // Re-plan
              try {
                  await this.plan.getPlan(this.domain); // Get the plan
                  this.bdiControlLoop(); // Recursive call of the BDI control loop function to execute the next action
              } catch {
                  this.start(); // If something goes wrong, start again
              }
              return;
          }

          if (this.intentions.reconsider()) {
              // Do agent need to reconsider the intentions?
              // If yes, then reconsider the intentions
              let desires = new Desires(this.beliefs);
              this.intentions.filter(desires);
          }

          // Checking if the plan is sound or not
          if (!this.plan.isSound(this.beliefs, this.intentions)) {
              // If the plan is not sound, then re-plan
              this.plan = new Plan(this.intentions, this.beliefs);
              try {
                  await this.plan.getPlan(this.domain);
                  this.bdiControlLoop();
              } catch {
                  this.start();
              }
              return;
          }

          // Recursive call of the BDI control loop function to execute the next action
          this.bdiControlLoop();
      } else {
          // If the plan is empty or the intentions have succeeded or impossible,
          // then wait for possible updates from the environment
          // And get desires, filter intentions, and get plan again
          setTimeout(async () => {
              let desires = new Desires(this.beliefs, this.intentions); // Get desires
              this.intentions.filter(desires); // Filter intentions
              this.plan = new Plan(this.intentions, this.beliefs); // Get plan
              try {
                  await this.plan.getPlan(this.domain);
                  this.bdiControlLoop();
              } catch {
                  this.start();
              }
              return;
          }, 30);
      }
    }

    /**
     * Function to execute the action. It takes a string action as input
     * Action can be: "left", "right", "up", "down", "pick_up", "put_down", "wait"
     * To execute the action, it uses the Deliveroo Client API and returns a promise of boolean
     * @param {string} action
     * @returns {Promise<boolean>}
     */
    execute(action) {
        return new Promise((resolve, reject) => {
            if (
                action === "left" ||
                action === "right" ||
                action === "up" ||
                action === "down"
            ) {
                this.client.move(action).then((status) => {
                    resolve(status);
                });
            } else if (action === "pick_up") {
                this.client.pickup().then((status) => {
                    resolve(status);
                });
            } else if (action === "put_down") {
                this.client.putdown().then((status) => {
                    resolve(status);
                });
            } else if (action === "wait") {
                setTimeout(() => {
                    resolve(true);
                }, 1000);
            } else {
                setTimeout(() => {
                    resolve(false);
                }, 1000);
            }
        });
    }
}

export {Agent};
