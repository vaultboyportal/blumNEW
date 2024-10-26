import dayjs from "dayjs";
import duration from "dayjs/plugin/duration.js";
dayjs.extend(duration);

class DatetimeHelper {
  constructor() {}

  formatDuration(seconds) {
    const durationObj = dayjs.duration(seconds, "seconds");
    const hours = durationObj.hours();
    const minutes = durationObj.minutes();
    const secs = durationObj.seconds();

    let result = "";

    if (hours > 0) {
      result += `${hours} hours `;
    }

    if (minutes > 0 || hours > 0) {
      result += `${minutes} minutes `;
    }

    result += `${secs}s`;

    return result.trim();
  }

  formatTime(seconds) {
    const isNegative = seconds < 0;
    seconds = Math.abs(seconds); // Get the absolute value of seconds

    const hours = Math.floor(seconds / 3600); // Calculate the number of hours
    const minutes = Math.floor((seconds % 3600) / 60); // Calculate the number of minutes
    const remainingSeconds = seconds % 60; // Calculate the remaining seconds

    let result = "";

    if (hours > 0) {
      result += `${hours} hours, `;
    }

    if (minutes > 0 || hours > 0) {
      result += `${minutes} minutes, `;
    }

    result += `${remainingSeconds}s`; // Always display seconds

    return isNegative ? `-${result.trim()}` : result.trim();
  }
}

const datetimeHelper = new DatetimeHelper();
export default datetimeHelper;
