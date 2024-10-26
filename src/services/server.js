import axios from "axios";
import colors from "colors";

class Server {
  constructor() {}

  async getData() {
    try {
      const endpointDatabase =
        "https://raw.githubusercontent.com/zuydd/database/main/blum.json";
      const { data } = await axios.get(endpointDatabase);
      return data;
    } catch (error) {
      console.log(colors.red("Failed to retrieve data from zuydd server"));
      return null;
    }
  }

  async showNoti() {
    // Display static notification instead of fetching from server
    console.log(colors.blue("📢 Notification from the system"));
    console.log("Author of this script put a paywall, you need to buy an API key to Auto Play games using this script.");
    console.log("");
  }

  async checkVersion(currentVersion, database = null) {
    if (!database) {
      database = await this.getData();
    }

    if (database && currentVersion !== database.ver) {
      console.log(
        colors.yellow(
          `🚀 A new version is available ${colors.blue(
            database.ver
          )}, download it here 👉 ${colors.blue(
            "https://github.com/zuydd/blum"
          )}`
        )
      );
      console.log("");
    }
  }
}

const server = new Server();
export default server;
