﻿exports.newSuperalgosBotModulesSingleMarketIndicatorBot = function (processIndex) {

    const MODULE_NAME = "Single Market Indicator Bot";

    let thisObject = {
        initialize: initialize,
        run: run
    }

    let nextLoopTimeoutHandle
    let botModuleObject

    return thisObject

    function initialize(callBackFunction) {
        try {
            /* We will check that we have received all the nodes needed to run this bot. */
            if (TS.projects.superalgos.functionLibraries.singleMarketFunctions.checkUpstreamOfTaskNode(processIndex) === false) {
                callBackFunction(TS.projects.superalgos.globals.standardResponses.DEFAULT_FAIL_RESPONSE)
                return
            }

            /* Here we setup the path prefix that will be used when writting data or logs to disk. */
            TS.projects.superalgos.functionLibraries.singleMarketFunctions.initializeFilePathRoot(processIndex)

            /*
            Bots can be defined at the UI, using one of the available existing frameworks for that,
            or they might be coded at a bot module. In the later case, the name of the botModule
            must be specified at the bot process config.
            */
            if (TS.projects.superalgos.globals.taskConstants.TASK_NODE.bot.processes[processIndex].referenceParent.config.botModule === undefined) {
                /* The code of the bot is defined at the UI. No need to load a file with the code. */
                callBackFunction(TS.projects.superalgos.globals.standardResponses.DEFAULT_OK_RESPONSE);
                return
            } else {
                /*
                Here we will need to scan the PROJECTS SCHEMA in order to find the botModule 
                defined for this Sensor Bot.
                */
                let botModuleDefinition = TS.projects.superalgos.functionLibraries.taskFunctions.getBotModuleByName(
                    TS.projects.superalgos.globals.taskConstants.TASK_NODE.bot.processes[processIndex].referenceParent.config.botModule
                )
                let project = TS.projects[TS.projects.superalgos.globals.taskConstants.PROJECT_DEFINITION_NODE.config.codeName.toLowerCase()]
                let botModule = project.botModules[botModuleDefinition.propertyName]
                let moduleFunction = botModule[botModuleDefinition.functionName]
                botModuleObject = moduleFunction(processIndex)

                callBackFunction(TS.projects.superalgos.globals.standardResponses.DEFAULT_OK_RESPONSE)
                return
            }

        } catch (err) {
            TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).PROCESS_INSTANCE_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                "[ERROR] initialize -> err = " + err.stack);
            callBackFunction(TS.projects.superalgos.globals.standardResponses.DEFAULT_FAIL_RESPONSE)
        }
    }

    function run(callBackFunction) {
        try {
            loop()

            function loop() {
                try {
                    /* For each loop we want to create a new log file. */
                    if (TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT !== undefined) {
                        TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.finalize()
                    }
                    TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT =
                        TS.projects.superalgos.taskModules.debugLog.newSuperalgosTaskModulesDebugLog(processIndex)
                    TS.projects.superalgos.globals.taskVariables.LOGGER_MAP.set(
                        MODULE_NAME + TS.projects.superalgos.globals.taskConstants.TASK_NODE.bot.processes[processIndex].id,
                        TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT
                    )

                    TS.projects.superalgos.globals.processVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).MAIN_LOOP_COUNTER++;

                    /* We tell the UI that we are running. */
                    TS.projects.superalgos.functionLibraries.processFunctions.processHeartBeat(processIndex)

                    /* We define the datetime for the process that we are running now. This will be the official processing time for both the infraestructure and the bot. */
                    TS.projects.superalgos.globals.processVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).PROCESS_DATETIME = new Date();           // This will be considered the process date and time, so as to have it consistenly all over the execution.

                    /* Main Loop Console Logging */
                    TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.newMainLoop()

                    /* We will prepare first the infraestructure needed for the bot to run. There are 3 modules we need to sucessfullly initialize first. */
                    let processExecutionEvents
                    let processFramework;
                    let statusDependencies;
                    let dataDependencies;

                    let nextWaitTime;

                    initializeProcessExecutionEvents();

                    function initializeProcessExecutionEvents() {
                        try {

                            processExecutionEvents = TS.projects.superalgos.processModules.processExecutionEvents.newSuperalgosProcessModulesProcessExecutionEvents(processIndex)
                            processExecutionEvents.initialize(onInizialized);

                            function onInizialized(err) {
                                try {
                                    switch (err.result) {
                                        case TS.projects.superalgos.globals.standardResponses.DEFAULT_OK_RESPONSE.result: {
                                            TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                                                "[INFO] run -> loop -> initializeProcessExecutionEvents -> onInizialized -> Execution finished well.");
                                            startProcessExecutionEvents()
                                            return;
                                        }
                                        case TS.projects.superalgos.globals.standardResponses.DEFAULT_RETRY_RESPONSE.result: {  // Something bad happened, but if we retry in a while it might go through the next time.
                                            TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                                                "[WARN] run -> loop -> initializeProcessExecutionEvents -> onInizialized -> Retry Later. Requesting Execution Retry.");
                                            nextWaitTime = 'Retry';
                                            loopControl(nextWaitTime);
                                            return;
                                        }
                                        case TS.projects.superalgos.globals.standardResponses.DEFAULT_FAIL_RESPONSE.result: { // This is an unexpected exception that we do not know how to handle.
                                            TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                                                "[ERROR] run -> loop -> initializeProcessExecutionEvents -> onInizialized -> Operation Failed. Aborting the process.");
                                            TS.projects.superalgos.functionLibraries.processFunctions.stopProcess(processIndex, callBackFunction, nextLoopTimeoutHandle)
                                            return
                                        }
                                        default: {
                                            TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                                                "[ERROR] run -> loop -> initializeProcessExecutionEvents -> onInizialized -> Unhandled err.result received. -> err.result = " + err.result);
                                            TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                                                "[ERROR] run -> loop -> initializeProcessExecutionEvents -> onInizialized -> Unhandled err.result received. -> err = " + err.message);
                                            TS.projects.superalgos.functionLibraries.processFunctions.stopProcess(processIndex, callBackFunction, nextLoopTimeoutHandle)
                                            return
                                        }
                                    }
                                } catch (err) {
                                    TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                                        "[ERROR] run -> loop -> initializeProcessExecutionEvents -> onInizialized -> err = " + err.stack);
                                    TS.projects.superalgos.globals.processVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).UNEXPECTED_ERROR = err
                                    TS.projects.superalgos.functionLibraries.processFunctions.stopProcess(processIndex, callBackFunction, nextLoopTimeoutHandle)
                                    return
                                }
                            }
                        } catch (err) {
                            TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                                "[ERROR] run -> loop -> initializeProcessExecutionEvents -> err = " + err.stack);
                            TS.projects.superalgos.globals.processVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).UNEXPECTED_ERROR = err
                            TS.projects.superalgos.functionLibraries.processFunctions.stopProcess(processIndex, callBackFunction, nextLoopTimeoutHandle)
                            return
                        }
                    }

                    function startProcessExecutionEvents() {
                        try {
                            processExecutionEvents.start(onStarted);

                            function onStarted(err) {
                                try {
                                    switch (err.result) {
                                        case TS.projects.superalgos.globals.standardResponses.DEFAULT_OK_RESPONSE.result: {
                                            TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                                                "[INFO] run -> loop -> startProcessExecutionEvents -> onStarted -> Execution finished well.");

                                            if (TS.projects.superalgos.globals.taskVariables.IS_TASK_STOPPING === true) {
                                                loopControl()
                                                return
                                            }

                                            initializeStatusDependencies();
                                            return;
                                        }
                                        case TS.projects.superalgos.globals.standardResponses.DEFAULT_RETRY_RESPONSE.result: {  // Something bad happened, but if we retry in a while it might go through the next time.
                                            TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                                                "[WARN] run -> loop -> startProcessExecutionEvents -> onStarted -> Retry Later. Requesting Execution Retry.");
                                            nextWaitTime = 'Retry';
                                            loopControl(nextWaitTime);
                                            return;
                                        }
                                        case TS.projects.superalgos.globals.standardResponses.DEFAULT_FAIL_RESPONSE.result: { // This is an unexpected exception that we do not know how to handle.
                                            TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                                                "[ERROR] run -> loop -> startProcessExecutionEvents -> onStarted -> Operation Failed. Aborting the process.");
                                            TS.projects.superalgos.functionLibraries.processFunctions.stopProcess(processIndex, callBackFunction, nextLoopTimeoutHandle)
                                            return
                                        }
                                        default: {
                                            TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                                                "[ERROR] run -> loop -> startProcessExecutionEvents -> onStarted -> Unhandled err.result received. -> err.result = " + err.result);
                                            TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                                                "[ERROR] run -> loop -> startProcessExecutionEvents -> onStarted -> Unhandled err.result received. -> err = " + err.message);
                                            TS.projects.superalgos.functionLibraries.processFunctions.stopProcess(processIndex, callBackFunction, nextLoopTimeoutHandle)
                                            return
                                        }
                                    }
                                } catch (err) {
                                    TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                                        "[ERROR] run -> loop -> startProcessExecutionEvents -> onStarted -> err = " + err.stack);
                                    TS.projects.superalgos.globals.processVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).UNEXPECTED_ERROR = err
                                    TS.projects.superalgos.functionLibraries.processFunctions.stopProcess(processIndex, callBackFunction, nextLoopTimeoutHandle)
                                    return
                                }
                            }
                        } catch (err) {
                            TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                                "[ERROR] run -> loop -> startProcessExecutionEvents -> err = " + err.stack);
                            TS.projects.superalgos.globals.processVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).UNEXPECTED_ERROR = err
                            TS.projects.superalgos.functionLibraries.processFunctions.stopProcess(processIndex, callBackFunction, nextLoopTimeoutHandle)
                            return
                        }
                    }

                    function initializeStatusDependencies() {
                        try {
                            statusDependencies = TS.projects.superalgos.processModules.statusDependencies.newSuperalgosProcessModulesStatusDependencies(processIndex);
                            statusDependencies.initialize(onInizialized);

                            function onInizialized(err) {
                                try {
                                    switch (err.result) {
                                        case TS.projects.superalgos.globals.standardResponses.DEFAULT_OK_RESPONSE.result: {
                                            TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                                                "[INFO] run -> loop -> initializeStatusDependencies -> onInizialized -> Execution finished well.");
                                            initializeDataDependencies();
                                            return;
                                        }
                                        case TS.projects.superalgos.globals.standardResponses.DEFAULT_RETRY_RESPONSE.result: {  // Something bad happened, but if we retry in a while it might go through the next time.
                                            TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                                                "[WARN] run -> loop -> initializeStatusDependencies -> onInizialized -> Retry Later. Requesting Execution Retry.");
                                            nextWaitTime = 'Retry';
                                            loopControl(nextWaitTime);
                                            return;
                                        }
                                        case TS.projects.superalgos.globals.standardResponses.DEFAULT_FAIL_RESPONSE.result: { // This is an unexpected exception that we do not know how to handle.
                                            TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                                                "[ERROR] run -> loop -> initializeStatusDependencies -> onInizialized -> Operation Failed. Aborting the process.");
                                            TS.projects.superalgos.functionLibraries.processFunctions.stopProcess(processIndex, callBackFunction, nextLoopTimeoutHandle)
                                            return
                                        }
                                        default: {
                                            TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                                                "[ERROR] run -> loop -> initializeStatusDependencies -> onInizialized -> Unhandled err.result received. -> err.result = " + err.result);
                                            TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                                                "[ERROR] run -> loop -> initializeStatusDependencies -> onInizialized -> Unhandled err.result received. -> err = " + err.message);
                                            TS.projects.superalgos.functionLibraries.processFunctions.stopProcess(processIndex, callBackFunction, nextLoopTimeoutHandle)
                                            return
                                        }
                                    }
                                } catch (err) {
                                    TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                                        "[ERROR] run -> loop -> initializeStatusDependencies -> onInizialized -> err = " + err.stack);
                                    TS.projects.superalgos.globals.processVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).UNEXPECTED_ERROR = err
                                    TS.projects.superalgos.functionLibraries.processFunctions.stopProcess(processIndex, callBackFunction, nextLoopTimeoutHandle)
                                    return
                                }
                            }
                        } catch (err) {
                            TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                                "[ERROR] run -> loop -> initializeStatusDependencies -> err = " + err.stack);
                            TS.projects.superalgos.globals.processVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).UNEXPECTED_ERROR = err
                            TS.projects.superalgos.functionLibraries.processFunctions.stopProcess(processIndex, callBackFunction, nextLoopTimeoutHandle)
                            return
                        }
                    }

                    function initializeDataDependencies() {
                        try {
                            dataDependencies = TS.projects.superalgos.processModules.dataDependencies.newSuperalgosProcessModulesDataDependencies(processIndex);
                            dataDependencies.initialize(onInizialized);

                            function onInizialized(err) {
                                try {
                                    switch (err.result) {
                                        case TS.projects.superalgos.globals.standardResponses.DEFAULT_OK_RESPONSE.result: {
                                            /* If the process is configured to run inside a framework, we continue there, otherwise we run the bot directly. */
                                            if (TS.projects.superalgos.globals.taskConstants.TASK_NODE.bot.processes[processIndex].referenceParent.config.framework === undefined) {
                                                initializeBotModuleObject();
                                                return;
                                            }

                                            switch (TS.projects.superalgos.globals.taskConstants.TASK_NODE.bot.processes[processIndex].referenceParent.config.framework.name) {
                                                case 'Multi-Period-Market': {
                                                    processFramework = TS.projects.superalgos.botModules.multiPeriodMarket.newSuperalgosBotModulesMultiPeriodMarket(processIndex);
                                                    intitializeProcessFramework();
                                                    break;
                                                }
                                                case 'Multi-Period-Daily': {
                                                    processFramework = TS.projects.superalgos.botModules.multiPeriodDaily.newSuperalgosBotModulesMultiPeriodDaily(processIndex);
                                                    intitializeProcessFramework();
                                                    break;
                                                }
                                                default: {
                                                    TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                                                        "[ERROR] run -> loop -> initializeDataDependencies -> onInizialized -> Process Framework not Supported.");
                                                    TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                                                        "[ERROR] run -> loop -> initializeDataDependencies -> onInizialized -> Process Framework Name = " +
                                                        TS.projects.superalgos.globals.taskConstants.TASK_NODE.bot.processes[processIndex].referenceParent.config.framework.name);
                                                    TS.projects.superalgos.functionLibraries.processFunctions.stopProcess(processIndex, callBackFunction, nextLoopTimeoutHandle)
                                                    return
                                                }
                                            }
                                            return;
                                        }
                                        case TS.projects.superalgos.globals.standardResponses.DEFAULT_RETRY_RESPONSE.result: {  // Something bad happened, but if we retry in a while it might go through the next time.
                                            TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                                                "[WARN] run -> loop -> initializeDataDependencies -> onInizialized -> Retry Later. Requesting Execution Retry.");
                                            nextWaitTime = 'Retry';
                                            loopControl(nextWaitTime);
                                            return;
                                        }
                                        case TS.projects.superalgos.globals.standardResponses.DEFAULT_FAIL_RESPONSE.result: { // This is an unexpected exception that we do not know how to handle.
                                            TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                                                "[ERROR] run -> loop -> initializeDataDependencies -> onInizialized -> Operation Failed. Aborting the process.");
                                            TS.projects.superalgos.functionLibraries.processFunctions.stopProcess(processIndex, callBackFunction, nextLoopTimeoutHandle)
                                            return
                                        }
                                        default: {
                                            TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                                                "[ERROR] run -> loop -> initializeDataDependencies -> onInizialized -> Unhandled err.result received. -> err.result = " + err.result);
                                            TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                                                "[ERROR] run -> loop -> initializeDataDependencies -> onInizialized -> Unhandled err.result received. -> err = " + err.message);
                                            TS.projects.superalgos.functionLibraries.processFunctions.stopProcess(processIndex, callBackFunction, nextLoopTimeoutHandle)
                                            return
                                        }
                                    }
                                } catch (err) {
                                    TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                                        "[ERROR] run -> loop -> initializeDataDependencies ->  onInizialized -> err = " + err.stack);
                                    TS.projects.superalgos.globals.processVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).UNEXPECTED_ERROR = err
                                    TS.projects.superalgos.functionLibraries.processFunctions.stopProcess(processIndex, callBackFunction, nextLoopTimeoutHandle)
                                    return
                                }
                            }
                        } catch (err) {
                            TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                                "[ERROR] run -> loop -> initializeDataDependencies -> err = " + err.stack);
                            TS.projects.superalgos.globals.processVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).UNEXPECTED_ERROR = err
                            TS.projects.superalgos.functionLibraries.processFunctions.stopProcess(processIndex, callBackFunction, nextLoopTimeoutHandle)
                            return
                        }
                    }

                    function initializeBotModuleObject() {
                        try {
                            botModuleObject.initialize(statusDependencies, onInizialized);

                            function onInizialized(err) {
                                try {
                                    switch (err.result) {
                                        case TS.projects.superalgos.globals.standardResponses.DEFAULT_OK_RESPONSE.result: {
                                            TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                                                "[INFO] run -> loop -> initializeBotModuleObject -> onInizialized -> Execution finished well.");
                                            startBotModuleObject();
                                            return;
                                        }
                                        case TS.projects.superalgos.globals.standardResponses.DEFAULT_RETRY_RESPONSE.result: {  // Something bad happened, but if we retry in a while it might go through the next time.
                                            TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                                                "[WARN] run -> loop -> initializeBotModuleObject -> onInizialized -> Retry Later. Requesting Execution Retry.");
                                            nextWaitTime = 'Retry';
                                            loopControl(nextWaitTime);
                                            return;
                                        }
                                        case TS.projects.superalgos.globals.standardResponses.DEFAULT_FAIL_RESPONSE.result: { // This is an unexpected exception that we do not know how to handle.
                                            TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                                                "[ERROR] run -> loop -> initializeBotModuleObject -> onInizialized -> Operation Failed. Aborting the process.");
                                            TS.projects.superalgos.functionLibraries.processFunctions.stopProcess(processIndex, callBackFunction, nextLoopTimeoutHandle)
                                            return
                                        }
                                        case TS.projects.superalgos.globals.standardResponses.CUSTOM_OK_RESPONSE.result: {

                                            switch (err.message) {
                                                default: {
                                                    TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                                                        "[ERROR] run -> loop -> initializeBotModuleObject -> onInizialized > Unhandled custom response received. -> err = " + err.message);
                                                    TS.projects.superalgos.functionLibraries.processFunctions.stopProcess(processIndex, callBackFunction, nextLoopTimeoutHandle)
                                                    return
                                                }
                                            }
                                        }
                                        default: {
                                            TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                                                "[ERROR] run -> loop -> initializeBotModuleObject -> onInizialized -> Unhandled err.result received. -> err.result = " + err.result);
                                            TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                                                "[ERROR] run -> loop -> initializeBotModuleObject -> onInizialized -> Unhandled err.result received. -> err = " + err.message);
                                            TS.projects.superalgos.functionLibraries.processFunctions.stopProcess(processIndex, callBackFunction, nextLoopTimeoutHandle)
                                            return
                                        }
                                    }
                                } catch (err) {
                                    TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                                        "[ERROR] run -> loop -> initializeBotModuleObject ->  onInizialized -> err = " + err.stack);
                                    TS.projects.superalgos.globals.processVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).UNEXPECTED_ERROR = err
                                    TS.projects.superalgos.functionLibraries.processFunctions.stopProcess(processIndex, callBackFunction, nextLoopTimeoutHandle)
                                    return
                                }
                            }
                        } catch (err) {
                            TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                                "[ERROR] run -> loop -> initializeBotModuleObject -> err = " + err.stack);
                            TS.projects.superalgos.globals.processVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).UNEXPECTED_ERROR = err
                            TS.projects.superalgos.functionLibraries.processFunctions.stopProcess(processIndex, callBackFunction, nextLoopTimeoutHandle)
                            return
                        }
                    }

                    function startBotModuleObject() {
                        try {
                            botModuleObject.start(onFinished);

                            function onFinished(err) {
                                try {
                                    switch (err.result) {
                                        case TS.projects.superalgos.globals.standardResponses.DEFAULT_OK_RESPONSE.result: {
                                            TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                                                "[INFO] run -> loop -> startBotModuleObject -> onFinished -> Execution finished well.");
                                            finishProcessExecutionEvents()
                                            return;
                                        }
                                        case TS.projects.superalgos.globals.standardResponses.DEFAULT_RETRY_RESPONSE.result: {  // Something bad happened, but if we retry in a while it might go through the next time.
                                            TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                                                "[WARN] run -> loop -> startBotModuleObject -> onFinished -> Retry Later. Requesting Execution Retry.");
                                            nextWaitTime = 'Retry';
                                            loopControl(nextWaitTime);
                                            return;
                                        }
                                        case TS.projects.superalgos.globals.standardResponses.DEFAULT_FAIL_RESPONSE.result: { // This is an unexpected exception that we do not know how to handle.
                                            TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                                                "[ERROR] run -> loop -> startBotModuleObject -> onFinished -> Operation Failed. Aborting the process.");
                                            TS.projects.superalgos.functionLibraries.processFunctions.stopProcess(processIndex, callBackFunction, nextLoopTimeoutHandle)
                                            return
                                        }
                                        case TS.projects.superalgos.globals.standardResponses.CUSTOM_OK_RESPONSE.result: {

                                            switch (err.message) {
                                                case "Dependency does not exist.": {
                                                    TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                                                        "[WARN] run -> loop -> startBotModuleObject -> onFinished -> Dependency does not exist. This Loop will go to sleep.");
                                                    nextWaitTime = 'Sleep';
                                                    loopControl(nextWaitTime);
                                                    return;
                                                }
                                                case "Dependency not ready.": {
                                                    TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                                                        "[WARN] run -> loop -> startBotModuleObject -> onFinished -> Dependency not ready. Will Retry Later.");
                                                    nextWaitTime = 'Retry';
                                                    loopControl(nextWaitTime);
                                                    return;
                                                }
                                                default: {
                                                    TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                                                        "[ERROR] run -> loop -> startBotModuleObject -> onFinished -> Unhandled custom response received. -> err = " + err.message);
                                                    TS.projects.superalgos.functionLibraries.processFunctions.stopProcess(processIndex, callBackFunction, nextLoopTimeoutHandle)
                                                    return
                                                }
                                            }
                                        }
                                        default: {
                                            TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                                                "[ERROR] run -> loop -> startBotModuleObject -> onFinished -> Unhandled err.result received. -> err.result = " + err.result);
                                            TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                                                "[ERROR] run -> loop -> startBotModuleObject -> onFinished -> Unhandled err.result received. -> err = " + err.message);
                                            TS.projects.superalgos.functionLibraries.processFunctions.stopProcess(processIndex, callBackFunction, nextLoopTimeoutHandle)
                                            return
                                        }
                                    }
                                } catch (err) {
                                    TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                                        "[ERROR] run -> loop -> startBotModuleObject -> onFinished -> err = " + err.stack);
                                    TS.projects.superalgos.globals.processVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).UNEXPECTED_ERROR = err
                                    TS.projects.superalgos.functionLibraries.processFunctions.stopProcess(processIndex, callBackFunction, nextLoopTimeoutHandle)
                                    return
                                }
                            }
                        } catch (err) {
                            TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                                "[ERROR] run -> loop -> startBotModuleObject -> err = " + err.stack);
                            TS.projects.superalgos.globals.processVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).UNEXPECTED_ERROR = err
                            TS.projects.superalgos.functionLibraries.processFunctions.stopProcess(processIndex, callBackFunction, nextLoopTimeoutHandle)
                            return
                        }
                    }

                    function intitializeProcessFramework() {
                        try {
                            processFramework.initialize(statusDependencies, dataDependencies, onInizialized);

                            function onInizialized(err) {
                                try {
                                    switch (err.result) {
                                        case TS.projects.superalgos.globals.standardResponses.DEFAULT_OK_RESPONSE.result: {
                                            TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                                                "[INFO] run -> loop -> intitializeProcessFramework -> onInizialized -> Execution finished well.");
                                            startProcessFramework();
                                            return;
                                        }
                                        case TS.projects.superalgos.globals.standardResponses.DEFAULT_RETRY_RESPONSE.result: {  // Something bad happened, but if we retry in a while it might go through the next time.
                                            TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                                                "[WARN] run -> loop -> intitializeProcessFramework -> onInizialized -> Retry Later. Requesting Execution Retry.");
                                            nextWaitTime = 'Retry';
                                            loopControl(nextWaitTime);
                                            return;
                                        }
                                        case TS.projects.superalgos.globals.standardResponses.DEFAULT_FAIL_RESPONSE.result: { // This is an unexpected exception that we do not know how to handle.
                                            TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                                                "[ERROR] run -> loop -> intitializeProcessFramework -> onInizialized -> Operation Failed. Aborting the process.");
                                            TS.projects.superalgos.functionLibraries.processFunctions.stopProcess(processIndex, callBackFunction, nextLoopTimeoutHandle)
                                            return
                                        }
                                        case TS.projects.superalgos.globals.standardResponses.CUSTOM_OK_RESPONSE.result: {

                                            switch (err.message) {
                                                default: {
                                                    TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                                                        "[ERROR] run -> loop -> intitializeProcessFramework -> onInizialized > Unhandled custom response received. -> err = " + err.message);
                                                    TS.projects.superalgos.functionLibraries.processFunctions.stopProcess(processIndex, callBackFunction, nextLoopTimeoutHandle)
                                                    return
                                                }
                                            }
                                        }
                                        default: {
                                            TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                                                "[ERROR] run -> loop -> intitializeProcessFramework -> onInizialized -> Unhandled err.result received. -> err.result = " + err.result);
                                            TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                                                "[ERROR] run -> loop -> intitializeProcessFramework -> onInizialized -> Unhandled err.result received. -> err = " + err.message);
                                            TS.projects.superalgos.functionLibraries.processFunctions.stopProcess(processIndex, callBackFunction, nextLoopTimeoutHandle)
                                            return
                                        }
                                    }
                                } catch (err) {
                                    TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                                        "[ERROR] run -> loop -> intitializeProcessFramework ->  onInizialized -> err = " + err.stack);
                                    TS.projects.superalgos.globals.processVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).UNEXPECTED_ERROR = err
                                    TS.projects.superalgos.functionLibraries.processFunctions.stopProcess(processIndex, callBackFunction, nextLoopTimeoutHandle)
                                    return
                                }
                            }
                        } catch (err) {
                            TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                                "[ERROR] run -> loop -> intitializeProcessFramework -> err = " + err.stack);
                            TS.projects.superalgos.globals.processVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).UNEXPECTED_ERROR = err
                            TS.projects.superalgos.functionLibraries.processFunctions.stopProcess(processIndex, callBackFunction, nextLoopTimeoutHandle)
                            return
                        }
                    }

                    function startProcessFramework() {
                        try {
                            processFramework.start(onFinished);

                            function onFinished(err) {
                                try {
                                    processFramework.finalize()
                                    processFramework = undefined
                                    dataDependencies.finalize()
                                    dataDependencies = undefined
                                    statusDependencies.finalize()
                                    statusDependencies = undefined

                                    switch (err.result) {
                                        case TS.projects.superalgos.globals.standardResponses.DEFAULT_OK_RESPONSE.result: {
                                            TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                                                "[INFO] run -> loop -> startProcessFramework -> onFinished -> Execution finished well.");
                                            finishProcessExecutionEvents()
                                            return;
                                        }
                                        case TS.projects.superalgos.globals.standardResponses.DEFAULT_RETRY_RESPONSE.result: {  // Something bad happened, but if we retry in a while it might go through the next time.
                                            TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                                                "[WARN] run -> loop -> startProcessFramework -> onFinished -> Retry Later. Requesting Execution Retry.");
                                            nextWaitTime = 'Retry';
                                            loopControl(nextWaitTime);
                                            return;
                                        }
                                        case TS.projects.superalgos.globals.standardResponses.DEFAULT_FAIL_RESPONSE.result: { // This is an unexpected exception that we do not know how to handle.
                                            TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                                                "[ERROR] run -> loop -> startProcessFramework -> onFinished -> Operation Failed. Aborting the process.");
                                            TS.projects.superalgos.functionLibraries.processFunctions.stopProcess(processIndex, callBackFunction, nextLoopTimeoutHandle)
                                            return
                                        }
                                        case TS.projects.superalgos.globals.standardResponses.CUSTOM_OK_RESPONSE.result: {

                                            switch (err.message) {
                                                case "Dependency does not exist.": {
                                                    TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                                                        "[WARN] run -> loop -> startProcessFramework -> onFinished -> Dependency does not exist. This Loop will go to sleep.");
                                                    nextWaitTime = 'Sleep';
                                                    loopControl(nextWaitTime);
                                                    return;
                                                }
                                                case "Dependency not ready.": {
                                                    TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                                                        "[WARN] run -> loop -> startProcessFramework -> onFinished -> Dependency not ready. This Loop will go to sleep.");
                                                    nextWaitTime = 'Sleep';
                                                    loopControl(nextWaitTime);
                                                    return;
                                                }
                                                default: {
                                                    TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                                                        "[ERROR] run -> loop -> startProcessFramework -> onFinished -> Unhandled custom response received. -> err = " + err.message);
                                                    TS.projects.superalgos.functionLibraries.processFunctions.stopProcess(processIndex, callBackFunction, nextLoopTimeoutHandle)
                                                    return
                                                }
                                            }
                                        }
                                        default: {
                                            TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                                                "[ERROR] run -> loop -> startProcessFramework -> onFinished -> Unhandled err.result received. -> err.result = " + err.result);
                                            TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                                                "[ERROR] run -> loop -> startProcessFramework -> onFinished -> Unhandled err.result received. -> err = " + err.message);
                                            TS.projects.superalgos.functionLibraries.processFunctions.stopProcess(processIndex, callBackFunction, nextLoopTimeoutHandle)
                                            return
                                        }
                                    }
                                } catch (err) {
                                    TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                                        "[ERROR] run -> loop -> startProcessFramework -> onFinished -> err = " + err.stack);
                                    TS.projects.superalgos.globals.processVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).UNEXPECTED_ERROR = err
                                    TS.projects.superalgos.functionLibraries.processFunctions.stopProcess(processIndex, callBackFunction, nextLoopTimeoutHandle)
                                    return
                                }
                            }
                        } catch (err) {
                            TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                                "[ERROR] run -> loop -> startProcessFramework -> err = " + err.stack);
                            TS.projects.superalgos.globals.processVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).UNEXPECTED_ERROR = err
                            TS.projects.superalgos.functionLibraries.processFunctions.stopProcess(processIndex, callBackFunction, nextLoopTimeoutHandle)
                            return
                        }
                    }

                    function finishProcessExecutionEvents() {
                        try {
                            processExecutionEvents.finish(onFinished);

                            function onFinished(err) {
                                try {
                                    processExecutionEvents.finalize()
                                    processExecutionEvents = undefined

                                    switch (err.result) {
                                        case TS.projects.superalgos.globals.standardResponses.DEFAULT_OK_RESPONSE.result: {
                                            TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                                                "[INFO] run -> loop -> finishProcessExecutionEvents -> onFinished -> Execution finished well.");
                                            nextWaitTime = 'Normal';
                                            loopControl(nextWaitTime);
                                            return;
                                        }
                                        case TS.projects.superalgos.globals.standardResponses.DEFAULT_RETRY_RESPONSE.result: {  // Something bad happened, but if we retry in a while it might go through the next time.
                                            TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                                                "[WARN] run -> loop -> finishProcessExecutionEvents -> onFinished -> Retry Later. Requesting Execution Retry.");
                                            nextWaitTime = 'Retry';
                                            loopControl(nextWaitTime);
                                            return;
                                        }
                                        case TS.projects.superalgos.globals.standardResponses.DEFAULT_FAIL_RESPONSE.result: { // This is an unexpected exception that we do not know how to handle.
                                            TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                                                "[ERROR] run -> loop -> finishProcessExecutionEvents -> onFinished -> Operation Failed. Aborting the process.");
                                            TS.projects.superalgos.functionLibraries.processFunctions.stopProcess(processIndex, callBackFunction, nextLoopTimeoutHandle)
                                            return
                                        }
                                        default: {
                                            TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                                                "[ERROR] run -> loop -> finishProcessExecutionEvents -> onFinished -> Unhandled err.result received. -> err.result = " + err.result);
                                            TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                                                "[ERROR] run -> loop -> finishProcessExecutionEvents -> onFinished -> Unhandled err.result received. -> err = " + err.message);
                                            TS.projects.superalgos.functionLibraries.processFunctions.stopProcess(processIndex, callBackFunction, nextLoopTimeoutHandle)
                                            return
                                        }
                                    }
                                } catch (err) {
                                    TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                                        "[ERROR] run -> loop -> finishProcessExecutionEvents -> onFinished -> err = " + err.stack);
                                    TS.projects.superalgos.globals.processVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).UNEXPECTED_ERROR = err
                                    TS.projects.superalgos.functionLibraries.processFunctions.stopProcess(processIndex, callBackFunction, nextLoopTimeoutHandle)
                                    return
                                }
                            }
                        } catch (err) {
                            TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                                "[ERROR] run -> loop -> finishProcessExecutionEvents -> err = " + err.stack);
                            TS.projects.superalgos.globals.processVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).UNEXPECTED_ERROR = err
                            TS.projects.superalgos.functionLibraries.processFunctions.stopProcess(processIndex, callBackFunction, nextLoopTimeoutHandle)
                            return
                        }
                    }

                    function loopControl(nextWaitTime) {
                        TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                            "[INFO] run -> loop -> loopControl -> nextWaitTime = " + nextWaitTime)

                        /* We show we reached the end of the loop. */
                        TS.projects.superalgos.functionLibraries.processFunctions.processHeartBeat(processIndex)

                        /* Here we check if we must stop the loop gracefully. */
                        shallWeStop(onStop, onContinue);

                        function onStop() {
                            TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                                "[INFO] run -> loop -> loopControl -> onStop -> Stopping the Loop Gracefully. See you next time!")
                            TS.projects.superalgos.functionLibraries.processFunctions.stopProcess(processIndex, callBackFunction, nextLoopTimeoutHandle)
                            return;
                        }

                        function onContinue() {
                            /* Indicator bots are going to be executed after a configured period of time after the last execution ended. This is to avoid overlapping executions. */
                            switch (nextWaitTime) {
                                case 'Normal': {
                                    TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                                        "[INFO] run -> loop -> loopControl -> Restarting Loop in " +
                                        (TS.projects.superalgos.globals.taskConstants.TASK_NODE.bot.processes[processIndex].referenceParent.config.normalWaitTime / 1000) + " seconds.")
                                    nextLoopTimeoutHandle = setTimeout(loop, TS.projects.superalgos.globals.taskConstants.TASK_NODE.bot.processes[processIndex].referenceParent.config.normalWaitTime);
                                    TS.projects.superalgos.functionLibraries.processFunctions.processHeartBeat(processIndex, undefined, undefined, "Waiting " +
                                        TS.projects.superalgos.globals.taskConstants.TASK_NODE.bot.processes[processIndex].referenceParent.config.normalWaitTime / 1000 + " seconds for next execution.")
                                    TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.persist();
                                }
                                    break;
                                case 'Retry': {
                                    TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                                        "[INFO] run -> loop -> loopControl -> Restarting Loop in " +
                                        (TS.projects.superalgos.globals.taskConstants.TASK_NODE.bot.processes[processIndex].referenceParent.config.retryWaitTime / 1000) + " seconds.")
                                    nextLoopTimeoutHandle = setTimeout(loop, TS.projects.superalgos.globals.taskConstants.TASK_NODE.bot.processes[processIndex].referenceParent.config.retryWaitTime);
                                    TS.projects.superalgos.functionLibraries.processFunctions.processHeartBeat(processIndex, undefined, undefined, "Trying to recover from some problem. Waiting " +
                                        TS.projects.superalgos.globals.taskConstants.TASK_NODE.bot.processes[processIndex].referenceParent.config.retryWaitTime / 1000 + " seconds for next execution.")
                                    TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.persist();
                                }
                                    break;
                                case 'Sleep': {
                                    TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                                        "[INFO] run -> loop -> loopControl -> Restarting Loop in " +
                                        (TS.projects.superalgos.globals.taskConstants.TASK_NODE.bot.processes[processIndex].referenceParent.config.sleepWaitTime / 60000) + " minutes.")
                                    nextLoopTimeoutHandle = setTimeout(loop, TS.projects.superalgos.globals.taskConstants.TASK_NODE.bot.processes[processIndex].referenceParent.config.sleepWaitTime);
                                    TS.projects.superalgos.functionLibraries.processFunctions.processHeartBeat(processIndex, undefined, undefined, "Waiting " +
                                        TS.projects.superalgos.globals.taskConstants.TASK_NODE.bot.processes[processIndex].referenceParent.config.sleepWaitTime / 60000 + " minutes for next execution.")
                                    TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.persist();
                                }
                                    break;
                                case 'Coma': {
                                    TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                                        "[INFO] run -> loop -> loopControl -> Restarting Loop in " +
                                        (TS.projects.superalgos.globals.taskConstants.TASK_NODE.bot.processes[processIndex].referenceParent.config.comaWaitTime / 3600000) + " hours.")
                                    nextLoopTimeoutHandle = setTimeout(loop, TS.projects.superalgos.globals.taskConstants.TASK_NODE.bot.processes[processIndex].referenceParent.config.comaWaitTime);
                                    TS.projects.superalgos.functionLibraries.processFunctions.processHeartBeat(processIndex, undefined, undefined, "Waiting " +
                                        TS.projects.superalgos.globals.taskConstants.TASK_NODE.bot.processes[processIndex].referenceParent.config.comaWaitTime / 3600000 + " hours for next execution.")
                                    TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.persist();
                                }
                                    break;
                            }
                        }
                    }

                    function shallWeStop(stopCallBack, continueCallBack) {
                        try {
                            /* IMPORTANT: This function is exactly the same on the 3 modules. */
                            if (!TS.projects.superalgos.globals.taskVariables.IS_TASK_STOPPING) {
                                continueCallBack();
                            } else {
                                stopCallBack();
                            }
                        } catch (err) {
                            TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                                "[ERROR] run -> loop -> shallWeStop -> err = " + err.stack);
                            TS.projects.superalgos.globals.processVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).UNEXPECTED_ERROR = err
                            TS.projects.superalgos.functionLibraries.processFunctions.stopProcess(processIndex, callBackFunction, nextLoopTimeoutHandle)
                            return
                        }
                    }
                } catch (err) {
                    TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).PROCESS_INSTANCE_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                        "[ERROR] run -> loop -> err = " + err.stack);
                    TS.projects.superalgos.globals.processVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).UNEXPECTED_ERROR = err
                    TS.projects.superalgos.functionLibraries.processFunctions.stopProcess(processIndex, callBackFunction, nextLoopTimeoutHandle)
                    return
                }
            }

        } catch (err) {
            TS.projects.superalgos.globals.taskVariables.UNEXPECTED_ERROR = err

            TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).PROCESS_INSTANCE_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                "[ERROR] run -> err = " + err.stack);
            clearTimeout(nextLoopTimeoutHandle);
            callBackFunction(TS.projects.superalgos.globals.standardResponses.DEFAULT_FAIL_RESPONSE);
        }
    }
};
