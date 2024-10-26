import colors from "colors";
import delayHelper from "../helpers/delay.js";

class TaskService {
  constructor() {}

  removeDuplicatesTask(arr) {
    const seen = new Set();
    return arr.filter((item) => {
      if (seen.has(item.id)) {
        return false;
      }
      seen.add(item.id);
      return true;
    });
  }

  async getTask(user) {
    try {
      const { data } = await user.http.get(4, "tasks");
      if (data?.length) {
        return data;
      } else {
        throw new Error(`Failed to retrieve task list: ${data?.message}`);
      }
    } catch (error) {
      return -1;
    }
  }

  async startTask(user, task) {
    const param = `tasks/${task.id}/start`;
    let taskName = task.title;
    if (task.progressTarget) {
      taskName = `${task.title} ${task?.progressTarget?.target} ${task?.progressTarget?.postfix}`;
    }
    try {
      const { data } = await user.http.post(4, param, {});
      if (data && data.status === "STARTED") {
        return task.validationType === "KEYWORD"
          ? "READY_FOR_VERIFY"
          : "READY_FOR_CLAIM";
      } else {
        throw new Error(
          `Failed to start task ${colors.blue(taskName)}: ${data?.message}`
        );
      }
    } catch (error) {
      user.log.logError(
        `Failed to start task ${colors.blue(taskName)} - ${colors.gray(
          `[${task.id}]`
        )} failed: ${error.response?.data?.message}`
      );
      return "NOT_STARTED";
    }
  }

  async verifyTask(user, task) {
    let taskName = task.title;
    const param = `tasks/${task.id}/validate`;
    if (!user?.database?.tasks) {
      user.log.log(
        colors.yellow(
          `Task ${colors.blue(taskName)} doesn't have an answer yet, will retry later`
        )
      );
      return;
    }
    const taskDatabase = user?.database?.tasks.find((t) => t.id === task.id);
    if (!taskDatabase) {
      user.log.log(
        colors.yellow(
          `Task ${colors.blue(taskName)} doesn't have an answer yet, will retry later`
        )
      );
      return;
    }
    const body = { keyword: taskDatabase.answer };

    try {
      const { data } = await user.http.post(4, param, body);
      if (data && data.status === "READY_FOR_CLAIM") {
        return "READY_FOR_CLAIM";
      } else {
        throw new Error(
          `Failed to verify task ${colors.blue(taskName)}: ${data?.message}`
        );
      }
    } catch (error) {
      user.log.logError(
        `Failed to verify task ${colors.blue(taskName)} - ${colors.gray(
          `[${task.id}]`
        )} failed: ${error.response?.data?.message}`
      );
      return "NOT_STARTED";
    }
  }

  async claimTask(user, task, showLog = true) {
    const param = `tasks/${task.id}/claim`;
    let taskName = task.title;
    if (task.progressTarget) {
      taskName = `${task.title} ${task.target} ${task.postfix}`;
    }
    try {
      const { data } = await user.http.post(4, param, {});
      if (data && data.status === "FINISHED") {
        if (showLog) {
          user.log.log(
            `Successfully completed task ${colors.blue(
              taskName
            )}, reward: ${colors.green(task.reward + user.currency)}`
          );
        }
        return true;
      } else {
        throw new Error(
          `Failed to claim reward for task ${colors.blue(taskName)}: ${
            data?.message
          }`
        );
      }
    } catch (error) {
      if (showLog) {
        user.log.logError(
          `Failed to claim reward for task ${colors.blue(taskName)} - ${colors.gray(
            `[${task.id}]`
          )} failed: ${error.response?.data?.message}`
        );
      }
      return false;
    }
  }

  async handleTaskBasic(user, dataTasks, title) {
    const skipTasks = ["39391eb2-f031-4954-bd8a-e7aecbb1f192"];

    let tasksMerge = [];
    for (const item of dataTasks) {
      tasksMerge = tasksMerge.concat(item.tasks);
    }

    const tasksFilter = tasksMerge.filter(
      (task) =>
        !skipTasks.includes(task.id) &&
        task.status !== "FINISHED" &&
        !task.isHidden
    );
    const tasks = this.removeDuplicatesTask(tasksFilter);

    const taskList = tasks.filter(
      (task) => task.type !== "PROGRESS_TARGET" && task.status !== "STARTED"
    );

    if (taskList.length) {
      user.log.log(
        `There are ${colors.blue(taskList.length)} tasks ${colors.blue(
          title
        )} remaining to be completed`
      );
    } else {
      user.log.log(
        colors.magenta(
          `All tasks ${colors.blue(title)} are completed (except for manually skipped ones)`
        )
      );
    }

    await this.handleSingleTask(user, tasks);
  }

  async handleTaskMultiple(user, dataTasks, title) {
    const skipTasks = ["39391eb2-f031-4954-bd8a-e7aecbb1f192"];

    const tasksFilter = dataTasks.filter((task) => {
      if (task?.subTasks) {
        return (
          !skipTasks.includes(task.id) &&
          !task.subTasks.every((task) => task.status === "FINISHED") &&
          !task.isHidden
        );
      } else {
        return (
          !skipTasks.includes(task.id) &&
          !task.status === "FINISHED" &&
          !task.isHidden
        );
      }
    });

    if (tasksFilter.length) {
      user.log.log(
        `There are ${colors.blue(tasksFilter.length)} tasks ${colors.blue(
          title
        )} remaining to be completed`
      );
    } else {
      user.log.log(
        colors.magenta(
          `All tasks ${colors.blue(title)} are completed (except for manually skipped ones)`
        )
      );
    }

    for (const taskParent of tasksFilter) {
      user.log.log(
        `Starting task ${colors.blue(
          taskParent.title
        )}, waiting to complete all sub-tasks to claim reward`
      );

      if (!taskParent?.subTasks) {
        await this.handleSingleTask(user, [taskParent]);
      } else {
        let countDone = await this.handleSubTask(
          user,
          taskParent?.subTasks,
          taskParent?.title
        );
        if (countDone === taskParent?.subTasks?.length) {
          user.log.log(
            colors.magenta(
              `All tasks ${colors.blue(taskParent.title)} are completed (except for manually skipped ones)`
            )
          );
        } else {
          user.log.log(
            colors.yellow(
              `Not all sub-tasks of task ${colors.blue(taskParent.title)} are completed`
            )
          );
        }
      }
    }
  }

  async handleSingleTask(user, tasks) {
    const tasksErrorStart = [];
    const tasksErrorClaim = [];
    for (const task of tasks) {
      let complete = task.status;
      if (complete === "NOT_STARTED" && task.type !== "PROGRESS_TARGET") {
        complete = await this.startTask(user, task);
        if (complete === "NOT_STARTED") {
          tasksErrorStart.push(task);
        }
        await delayHelper.delay(3);
      }

      if (complete === "READY_FOR_VERIFY") {
        complete = await this.verifyTask(user, task);
      }
      if (complete === "READY_FOR_CLAIM") {
        const statusClaim = await this.claimTask(user, task);
        if (!statusClaim) {
          tasksErrorClaim.push(task);
        }
      }
    }

    if (tasksErrorStart.length || tasksErrorClaim.length) {
      user.log.log(colors.magenta("Retrying failed tasks..."));
      for (const task of tasksErrorStart) {
        let complete = task.status;
        if (complete === "NOT_STARTED" && task.type !== "PROGRESS_TARGET") {
          complete = await this.startTask(user, task);
        }
        if (complete === "READY_FOR_VERIFY") {
          complete = await this.verifyTask(user, task);
        }
        if (complete === "READY_FOR_CLAIM") {
          await this.claimTask(user, task);
        }
      }
      for (const task of tasksErrorClaim) {
        await this.claimTask(user, task);
      }
    }
  }

  async handleSubTask(user, subTask, nameTaskParent) {
    let countDone = 0;
    for (const task of subTask) {
      let complete = task.status;
      if (complete === "FINISHED") {
        countDone++;
        user.log.log(
          `✔️ Task completed ${colors.blue(
            nameTaskParent + " --> " + task.title
          )}`
        );
        continue;
      }
      if (complete === "NOT_STARTED" && task.type !== "PROGRESS_TARGET") {
        complete = await this.startTask(user, task);
        await delayHelper.delay(3);
      }
      if (complete === "READY_FOR_VERIFY") {
        complete = await this.verifyTask(user, task);
      }
      if (complete === "READY_FOR_CLAIM" || complete === "STARTED") {
        const statusClaim = await this.claimTask(user, task, false);
        if (statusClaim) {
          countDone++;
          user.log.log(
            `✔️ Task completed ${colors.blue(
              nameTaskParent + " --> " + task.title
            )}`
          );
        } else {
          user.log.logError(
            `❌ Task ${colors.blue(
              nameTaskParent + " --> " + task.title
            )} failed`
          );
        }
      }
    }
    return countDone;
  }

  async handleTask(user) {
    const maxRetryGetTask = 10;
    let countGetTask = 0;
    let tasks = await this.getTask(user);

    while (tasks === -1 && countGetTask <= maxRetryGetTask) {
      countGetTask++;
      tasks = await this.getTask(user);
    }

    if (countGetTask > maxRetryGetTask) {
      user.log.logError(`Failed to retrieve task list`);
      return;
    }

    for (const task of tasks) {
      if (task?.sectionType === "DEFAULT") {
        await this.handleTaskBasic(user, task.subSections, task.sectionType);
      } else {
        await this.handleTaskMultiple(user, task.tasks, task.sectionType);
      }
    }

    user.log.log(colors.magenta("All tasks are completed"));
  }
}

const taskService = new TaskService();
export default taskService;
