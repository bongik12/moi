exports.newNodeJsProcess = function () {

    let thisObject = {
        initialize: initialize
    }

    return thisObject;

    function initialize() {

        process.on('uncaughtException', function (err) {
            console.log('[ERROR] Task Server -> Node JS Process -> uncaughtException -> err.message = ' + err.message)
            console.log('[ERROR] Task Server -> Node JS Process -> uncaughtException -> err.stack = ' + err.stack)
            console.log(err.stack)
           TS.projects.superalgos.functionLibraries.nodeJSFunctions.exitProcess()
        })

        process.on('unhandledRejection', (reason, p) => {
            console.log('[ERROR] Task Server -> Node JS Process -> unhandledRejection -> reason = ' + JSON.stringify(reason))
            console.log('[ERROR] Task Server -> Node JS Process -> unhandledRejection -> p = ' + JSON.stringify(p))
            console.log(reason.stack)
           TS.projects.superalgos.functionLibraries.nodeJSFunctions.exitProcess()
        })

        process.on('exit', function (config) {

            if (TS.projects.superalgos.globals.taskConstants.TASK_NODE !== undefined) {
                /* We send an event signaling that the Task is being terminated. */
                let key = TS.projects.superalgos.globals.taskConstants.TASK_NODE.name + '-' + TS.projects.superalgos.globals.taskConstants.TASK_NODE.type + '-' + TS.projects.superalgos.globals.taskConstants.TASK_NODE.id

                TS.projects.superalgos.globals.taskConstants.EVENT_SERVER_CLIENT_MODULE_OBJECT.raiseEvent(key, 'Stopped') // Meaning Task Stopped
                TS.projects.superalgos.globals.taskConstants.EVENT_SERVER_CLIENT_MODULE_OBJECT.finalize()
                TS.projects.superalgos.globals.taskConstants.EVENT_SERVER_CLIENT_MODULE_OBJECT = undefined
            }

            //console.log('[INFO] Task Server -> Node JS Process -> process.on.exit -> About to exit -> config = ' + config)
        })

        /* Here we listen for the message to stop this Task / Process comming from the Task Manager, which is the paret of this node js process. */
        process.on('message', message => {
            if (message === 'Stop this Task') {

                TS.projects.superalgos.globals.taskVariables.IS_TASK_STOPPING = true;

                /*
                There are some process that might no be able to end grafully, for example the ones schedulle to process information in a future day or month.
                In order to be sure that the process will be terminated, we schedulle one forced exit in 2 minutes from now.
                */
                let key = TS.projects.superalgos.globals.taskConstants.TASK_NODE.name + '-' + TS.projects.superalgos.globals.taskConstants.TASK_NODE.type  
                console.log('[INFO] Task Server -> Node JS Process -> process.on -> Stopping Task ' + key + '. Nodejs process will be exited in less than 1 minute.')
                setTimeout(TS.projects.superalgos.functionLibraries.nodeJSFunctions.exitProcess, 60000);
            }
        });

    }
}