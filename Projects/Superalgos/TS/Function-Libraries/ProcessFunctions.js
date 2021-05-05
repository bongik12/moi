exports.newSuperalgosFunctionLibrariesProcessFunctions = function () {

    let thisObject = {
        processHeartBeat: processHeartBeat,
        processError: processError,
        processWarning: processWarning,
        processInfo: processInfo,
        stopProcess: stopProcess
    }

    return thisObject

    function stopProcess(processIndex, callBackFunction, nextLoopTimeoutHandle) {

        /* Make sure that the logger associated to this process saves its cache */
        TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.persist()

        /* Cancell this process timouput */
        clearTimeout(nextLoopTimeoutHandle)

        let error = TS.projects.superalgos.globals.processVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).UNEXPECTED_ERROR

        if (error !== undefined) {
            /* 
            If the process is finishing with an error, we report it to the UI 
            and return to the process caller with a FAIL.
            */
            let docs = {
                project: 'Superalgos',
                category: 'Topic',
                type: 'TS Process Error - Unexpected Error',
                placeholder: {}
            }

            if (error.message !== undefined) {
                docs.placeholder.errorMessage = {
                    style: 'Error',
                    text: error.message
                }
            }
            if (error.stack !== undefined) {
                docs.placeholder.errorStack = {
                    style: 'Javascript',
                    text: error.stack
                }
            }
            if (error.code !== undefined) {
                docs.placeholder.errorCode = {
                    style: 'Json',
                    text: error.code
                }
            }
            docs.placeholder.errorDetails = {
                style: 'Json',
                text: JSON.stringify(error, undefined, 4)
            }

            TS.projects.superalgos.functionLibraries.processFunctions.processError
                (
                    TS.projects.superalgos.globals.processVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).PROCESS_KEY,
                    undefined,
                    "An unexpected error caused the Process to stop.",
                    docs
                )

            callBackFunction(TS.projects.superalgos.globals.standardResponses.DEFAULT_FAIL_RESPONSE)
        } else {
            /*
            If the process did not finish with an error, we report to the UI that it stopped
            and return to the caller with OK.
            */
            TS.projects.superalgos.globals.taskConstants.EVENT_SERVER_CLIENT_MODULE_OBJECT.raiseEvent(
                TS.projects.superalgos.globals.processVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).PROCESS_KEY, 'Stopped')

            callBackFunction(TS.projects.superalgos.globals.standardResponses.DEFAULT_OK_RESPONSE)
        }
    }

    function processHeartBeat(processIndex, processingDate, percentage, status) {
        let event = {
            seconds: (new Date()).getSeconds(),
            processingDate: processingDate,
            percentage: percentage,
            status: status
        }
        TS.projects.superalgos.globals.taskConstants.EVENT_SERVER_CLIENT_MODULE_OBJECT.raiseEvent(TS.projects.superalgos.globals.processVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).PROCESS_KEY, 'Heartbeat', event)
    }

    function processError(processKey, node, errorMessage, docs) {
        let event
        if (node !== undefined) {
            event = {
                nodeName: node.name,
                nodeType: node.type,
                nodeId: node.id,
                errorMessage: errorMessage,
                docs: docs
            }
        } else {
            event = {
                errorMessage: errorMessage,
                docs: docs
            }
        }
        TS.projects.superalgos.globals.taskConstants.EVENT_SERVER_CLIENT_MODULE_OBJECT.raiseEvent(processKey, 'Error', event)
    }

    function processWarning(processKey, node, warningMessage, docs) {
        let event
        if (node !== undefined) {
            event = {
                nodeName: node.name,
                nodeType: node.type,
                nodeId: node.id,
                warningMessage: warningMessage,
                docs: docs
            }
        } else {
            event = {
                warningMessage: warningMessage,
                docs: docs
            }
        }
        TS.projects.superalgos.globals.taskConstants.EVENT_SERVER_CLIENT_MODULE_OBJECT.raiseEvent(processKey, 'Warning', event)
    }

    function processInfo(processKey, node, infoMessage, docs) {
        let event
        if (node !== undefined) {
            event = {
                nodeName: node.name,
                nodeType: node.type,
                nodeId: node.id,
                infoMessage: infoMessage,
                docs: docs
            }
        } else {
            event = {
                infoMessage: infoMessage,
                docs: docs
            }
        }
        TS.projects.superalgos.globals.taskConstants.EVENT_SERVER_CLIENT_MODULE_OBJECT.raiseEvent(processKey, 'Info', event)
    }
}