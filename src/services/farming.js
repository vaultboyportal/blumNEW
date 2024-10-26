import colors from "colors";
import dayjs from "dayjs";

class FarmingClass {
  constructor() {}

  async startFarming(user) {
    try {
      const { data } = await user.http.post(0, "farming/start", {});
      if (data) {
        user.log.log(
          `Farming started, wait to claim after: ${colors.blue("480 minutes")}`
        );
        return true;
      } else {
        throw new Error(`Failed to start farming: ${data.message}`);
      }
    } catch (error) {
      user.log.logError(
        `Failed to start farming: ${error.response?.data?.message}`
      );
      return false;
    }
  }

  async claimFarming(user, balance) {
    try {
      const { data } = await user.http.post(0, "farming/claim", {});
      if (data) {
        user.log.log(
          `Farming claim successful, reward: ${colors.green(
            balance + user.currency
          )}`
        );
        return true;
      } else {
        throw new Error(`Failed to claim farming: ${data.message}`);
      }
    } catch (error) {
      user.log.logError(
        `Failed to claim farming: ${error.response?.data?.message}`
      );
      return false;
    }
  }

  async handleFarming(user, infoFarming) {
    if (!infoFarming) {
      await this.startFarming(user);
      return 480;
    } else {
      const diffTimeClaim = dayjs().diff(dayjs(infoFarming?.endTime), "minute");

      if (diffTimeClaim > 0) {
        const statusClaim = await this.claimFarming(user, infoFarming?.balance);
        if (statusClaim) {
          await this.startFarming(user);
          return 480;
        } else {
          return 5;
        }
      } else {
        user.log.log(
          `Not time to claim yet, wait after: ${colors.blue(
            Math.abs(diffTimeClaim) + " minutes"
          )}`
        );
        return Math.abs(diffTimeClaim);
      }
    }
  }
}

const farmingClass = new FarmingClass();
export default farmingClass;
