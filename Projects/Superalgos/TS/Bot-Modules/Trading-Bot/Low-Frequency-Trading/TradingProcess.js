﻿exports.newSuperalgosBotModulesTradingProcess = function (processIndex) {
    /*
    This Module will load all the process data dependencies from files and send them downstream.
    After execution, will save the time range and status report of the process.
    */
    const MODULE_NAME = "Trading Process"

    thisObject = {
        start: start
    }

    return thisObject

    async function start(statusDependencies, dataDependenciesModule, callBackFunction) {
        try {

            let dataFiles = new Map()
            let multiTimeFrameDataFiles = new Map()
            TS.projects.superalgos.globals.processModuleObjects.MODULE_OBJECTS_BY_PROCESS_INDEX_MAP.get(processIndex).TRADING_ENGINE_MODULE_OBJECT = TS.projects.superalgos.botModules.tradingEngine.newSuperalgosBotModulesTradingEngine(processIndex)
            let tradingOutputModuleObject = TS.projects.superalgos.botModules.tradingOutput.newSuperalgosBotModulesTradingOutput(processIndex)

            let currentTimeFrame = {}

            /* Context Variables */
            let contextVariables = {
                lastFile: undefined,                // Datetime of the last file files successfully produced by this process.
                dateBeginOfMarket: undefined,       // Datetime of the first trade file in the whole market history.
                dateEndOfMarket: undefined          // Datetime of the last file available to be used as an input of this process.
            }

            if (
                TS.projects.superalgos.functionLibraries.processFilesFunctions.getContextVariables(
                    processIndex,
                    contextVariables,
                    statusDependencies,
                    TS.projects.superalgos.globals.processConstants.CONSTANTS_BY_PROCESS_INDEX_MAP.get(processIndex).SESSION_NODE.tradingParameters.timeRange.config.initialDatetime,
                    callBackFunction
                ) !== true) { return }

            if (TS.projects.superalgos.globals.processVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).IS_SESSION_FIRST_LOOP === true && TS.projects.superalgos.globals.processVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).IS_SESSION_RESUMING === false) {
                /* 
                Here is where the Trading Engine and Trading Systems received are moved to the simulation state.
                */
                TS.projects.superalgos.globals.processVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).SIMULATION_STATE.tradingEngine = TS.projects.superalgos.globals.processConstants.CONSTANTS_BY_PROCESS_INDEX_MAP.get(processIndex).TRADING_ENGINE_NODE
                TS.projects.superalgos.globals.processVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).SIMULATION_STATE.tradingSystem = TS.projects.superalgos.globals.processConstants.CONSTANTS_BY_PROCESS_INDEX_MAP.get(processIndex).TRADING_SYSTEM_NODE
            }

            /* We set up the Trading Engine Module. */
            TS.projects.superalgos.globals.processModuleObjects.MODULE_OBJECTS_BY_PROCESS_INDEX_MAP.get(processIndex).TRADING_ENGINE_MODULE_OBJECT.initialize()

            /* Initializing the Trading Process Date */
            if (TS.projects.superalgos.globals.processVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).IS_SESSION_FIRST_LOOP === true && TS.projects.superalgos.globals.processVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).IS_SESSION_RESUMING === false) {
                /* 
                This funcion is going to be called many times by the Trading Bot Loop.
                Only during the first execution and when the User is not resuming the execution
                of a stopped session / task; we are going to initialize the Process Date Time.
                This variable tell us which day we are standing at, specially while working
                with Daily Files. From this Date is that we are going to load the Daily Files.
                */
                TS.projects.superalgos.globals.processVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).SIMULATION_STATE.tradingEngine.tradingCurrent.tradingEpisode.processDate.value =
                    TS.projects.superalgos.utilities.dateTimeFunctions.removeTime(TS.projects.superalgos.globals.processConstants.CONSTANTS_BY_PROCESS_INDEX_MAP.get(processIndex).SESSION_NODE.tradingParameters.timeRange.config.initialDatetime).valueOf()
            }

            /* 
            This is the Date that is going to be used across the execution of this Trading Process. 
            We need this because it has a different life cycle than the processData stored at the 
            Trading Engine data structure. This date has to remain the same during the whole execution
            of the Trading Process until the end, inclusind the writting of Data Ranges and Status Reports.
            The processDate of the Trading Engine data structure on the other hand can be changed during
            the simulation loop, once we discover that all candles from a certain date have benn processed.
            Here is the point where we sync one and the other.
            */
            let tradingProcessDate = TS.projects.superalgos.utilities.dateTimeFunctions.removeTime(TS.projects.superalgos.globals.processVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).SIMULATION_STATE.tradingEngine.tradingCurrent.tradingEpisode.processDate.value)

            if (
                await TS.projects.superalgos.functionLibraries.dataDependenciesFunctions.processSingleFiles(
                    processIndex,
                    dataFiles,
                    multiTimeFrameDataFiles,
                    dataDependenciesModule
                ) === false) {
                TS.projects.superalgos.functionLibraries.sessionFunctions.sessionHeartBeat(processIndex, undefined, undefined, 'Waiting for Data Mining to be run')
                callBackFunction(TS.projects.superalgos.globals.standardResponses.DEFAULT_RETRY_RESPONSE)
                return
            }

            if (await TS.projects.superalgos.functionLibraries.dataDependenciesFunctions.processMarketFiles(
                processIndex,
                dataFiles,
                multiTimeFrameDataFiles,
                dataDependenciesModule,
                currentTimeFrame,
                TS.projects.superalgos.globals.processConstants.CONSTANTS_BY_PROCESS_INDEX_MAP.get(processIndex).SESSION_NODE.tradingParameters.timeFrame.config.label,
                TS.projects.superalgos.globals.processConstants.CONSTANTS_BY_PROCESS_INDEX_MAP.get(processIndex).SESSION_NODE.tradingParameters.timeRange.config.initialDatetime,
                TS.projects.superalgos.globals.processConstants.CONSTANTS_BY_PROCESS_INDEX_MAP.get(processIndex).SESSION_NODE.tradingParameters.timeRange.config.finalDatetime
            ) === false) {
                TS.projects.superalgos.functionLibraries.sessionFunctions.sessionHeartBeat(processIndex, undefined, undefined, 'Waiting for Data Mining to be run')
                callBackFunction(TS.projects.superalgos.globals.standardResponses.DEFAULT_RETRY_RESPONSE)
                return
            }
            /*
            These are the Data Structures used by end users at Conditions Code or Formulas.
            */
            let chart = {}
            let market = {}
            let exchange = {}
            /*
                Here we check if we need to get Daily Files or not. As an optimization, when 
                we are running on a Time Frame of 1hs or above, we are not going to load 
                dependencies on Daily Files. The way we recognize that is by checking if 
                we alreaady set a value to currentTimeFrame.value. We are also not going to loop
                through days if we are processing market files.
            */
            if (currentTimeFrame.value) {
                /* We are processing Market Files */
                /*
                With all the indicators data files loaded, we will build the chart object 
                data structure that will be used in user-defied conditions and formulas.
                */
                TS.projects.superalgos.functionLibraries.sessionFunctions.sessionHeartBeat(processIndex, undefined, undefined, 'Waking up')
                TS.projects.superalgos.functionLibraries.dataDependenciesFunctions.buildDataStructures(
                    processIndex,
                    dataDependenciesModule,
                    multiTimeFrameDataFiles,
                    currentTimeFrame,
                    chart,
                    market,
                    exchange,
                    callBackFunction
                )

                if (checkThereAreCandles() === true) {
                    TS.projects.superalgos.functionLibraries.sessionFunctions.sessionHeartBeat(processIndex, undefined, undefined, 'Running')
                    await outputManagement()
                    TS.projects.superalgos.functionLibraries.sessionFunctions.sessionHeartBeat(processIndex, undefined, undefined, 'Saving')
                    await TS.projects.superalgos.functionLibraries.processFilesFunctions.writeProcessFiles(processIndex, contextVariables, currentTimeFrame, tradingProcessDate, statusDependencies)
                    TS.projects.superalgos.functionLibraries.sessionFunctions.sessionHeartBeat(processIndex, undefined, undefined, 'Sleeping')
                } else {
                    TS.projects.superalgos.functionLibraries.sessionFunctions.sessionHeartBeat(processIndex, undefined, undefined, 'Waiting for Data Mining to be up to date. No candles found.')
                    callBackFunction(TS.projects.superalgos.globals.standardResponses.DEFAULT_RETRY_RESPONSE)
                    return
                }

            } else {
                /* We are processing Daily Files */
                do {
                    TS.projects.superalgos.functionLibraries.sessionFunctions.emitSessionStatus(TS.projects.superalgos.globals.processVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).SESSION_STATUS, TS.projects.superalgos.globals.processVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).SESSION_KEY)
                    /* 
                    We update the Trading Process Date with the date calculated at the simulation.
                    We will use this date to load indicator and output files. After that we will 
                    use it to save Output Files and later the Data Ranges. This is the point where
                    the date calculated by the Simulation is applied at the Trading Process Level.
                    */
                    tradingProcessDate = TS.projects.superalgos.utilities.dateTimeFunctions.removeTime(TS.projects.superalgos.globals.processVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).SIMULATION_STATE.tradingEngine.tradingCurrent.tradingEpisode.processDate.value)

                    if (checkStopTaskGracefully() === false) { break }
                    if (checkStopProcessing() === false) { break }

                    TS.projects.superalgos.functionLibraries.sessionFunctions.sessionHeartBeat(processIndex, undefined, undefined, 'Waking up')
                    if (
                        await TS.projects.superalgos.functionLibraries.dataDependenciesFunctions.processDailyFiles(
                            processIndex,
                            dataFiles,
                            multiTimeFrameDataFiles,
                            dataDependenciesModule,
                            currentTimeFrame,
                            TS.projects.superalgos.globals.processConstants.CONSTANTS_BY_PROCESS_INDEX_MAP.get(processIndex).SESSION_NODE.tradingParameters.timeFrame.config.label,
                            tradingProcessDate
                        ) === false) {
                        TS.projects.superalgos.functionLibraries.sessionFunctions.sessionHeartBeat(processIndex, undefined, undefined, 'Waiting for Data Mining to be run')
                        callBackFunction(TS.projects.superalgos.globals.standardResponses.DEFAULT_RETRY_RESPONSE)
                        return
                    }
                    /*
                    With all the indicators data files loaded, we will build the chart object 
                    data structure that will be used in user-defied conditions and formulas.
                    */
                    TS.projects.superalgos.functionLibraries.dataDependenciesFunctions.buildDataStructures(
                        processIndex,
                        dataDependenciesModule,
                        multiTimeFrameDataFiles,
                        currentTimeFrame,
                        chart,
                        market,
                        exchange,
                        callBackFunction
                    )
                    /*
                    The process of generating the output includes the trading simulation.
                    */
                    if (checkThereAreCandles() === true) {
                        TS.projects.superalgos.functionLibraries.sessionFunctions.sessionHeartBeat(processIndex, undefined, undefined, 'Running')
                        await outputManagement()
                        TS.projects.superalgos.functionLibraries.sessionFunctions.sessionHeartBeat(processIndex, undefined, undefined, 'Saving')
                        await TS.projects.superalgos.functionLibraries.processFilesFunctions.writeProcessFiles(processIndex, contextVariables, currentTimeFrame, tradingProcessDate, statusDependencies)
                        TS.projects.superalgos.functionLibraries.sessionFunctions.sessionHeartBeat(processIndex, undefined, undefined, 'Sleeping')
                    } else {
                        TS.projects.superalgos.functionLibraries.sessionFunctions.sessionHeartBeat(processIndex, undefined, undefined, 'Waiting for Data Mining to be up to date')
                        callBackFunction(TS.projects.superalgos.globals.standardResponses.DEFAULT_RETRY_RESPONSE)
                        return
                    }
                    /*
                    If for any reason the session was stopped, we will break this loop and exit the process.
                    */
                    if (TS.projects.superalgos.globals.processVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).IS_SESSION_STOPPING === true) { break }
                    /* 
                    When we get to the end of the market, we need to break this process loop in order
                    to let time pass, new information be collected from the exchange, new data built 
                    into indicators, and eventually a new execution of this process.
                    */
                    if (checkStopHeadOfTheMarket() === false) { break }

                }
                while (true)
            }

            checkIfSessionMustStop()
            /*
            Everything worked as expected. We return an OK code and wait for
            the Bot Loop to call us again later. 
            */
            callBackFunction(TS.projects.superalgos.globals.standardResponses.DEFAULT_OK_RESPONSE)

            function checkThereAreCandles() {
                let sessionParameters = TS.projects.superalgos.globals.processConstants.CONSTANTS_BY_PROCESS_INDEX_MAP.get(processIndex).SESSION_NODE.tradingParameters
                let propertyName = 'at' + sessionParameters.timeFrame.config.label.replace('-', '')
                let candles = chart[propertyName].candles

                if (candles === undefined || candles.length === 0) {
                    return false
                } else {
                    return true
                }
            }

            function checkStopHeadOfTheMarket() {
                /*  
                We need to check if we have reached the head of the market in order to know 
                when to break the Daily Files Process loop and give time for a new candles /
                indicators to be built and continue the processing once this process is called
                again. 
                */
                if (TS.projects.superalgos.globals.processVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).SIMULATION_STATE.tradingEngine.tradingCurrent.tradingEpisode.headOfTheMarket.value === true) {
                    return false
                }
            }

            function checkStopTaskGracefully() {
                /* Validation that we dont need to stop. */
                if (TS.projects.superalgos.globals.taskVariables.IS_TASK_STOPPING === true) {
                    return false
                }
            }

            function checkStopProcessing() {
                /* Validation that we dont need to stop. */
                if (TS.projects.superalgos.globals.processVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).IS_SESSION_STOPPING === true) {
                    return false
                }
            }

            async function outputManagement() {
                await tradingOutputModuleObject.start(
                    chart,
                    market,
                    exchange,
                    currentTimeFrame.value,
                    currentTimeFrame.label,
                    tradingProcessDate
                )

                /*
                From here on, all other loops executions wont be the first execution and also
                we will consider that it is not resuming a previous execution as well.
                */
                TS.projects.superalgos.globals.processVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).IS_SESSION_FIRST_LOOP = false
                TS.projects.superalgos.globals.processVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).IS_SESSION_RESUMING = false
            }

            function checkIfSessionMustStop() {

                if (TS.projects.superalgos.globals.processConstants.CONSTANTS_BY_PROCESS_INDEX_MAP.get(processIndex).SESSION_NODE.type === 'Backtesting Session') {
                    /*
                    Backtests needs only one execution of this process to complete.
                    */
                    TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                        '[IMPORTANT] checkIfSessionMustStop -> Backtesting Session Finished. Stopping the Session now. ')
                    TS.projects.superalgos.functionLibraries.sessionFunctions.stopSession(processIndex, 'Backtesting Session Finished.')
                }
            }
        }
        catch (err) {
            /* An unhandled exception occured. in this case we return Fail and log the stack. */
            if (err.stack) {
                TS.projects.superalgos.globals.processVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).UNEXPECTED_ERROR = err
                TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                    "[ERROR] start -> Unhandled Exception. Will Abort this process. err = " + err.stack)
                callBackFunction(TS.projects.superalgos.globals.standardResponses.DEFAULT_FAIL_RESPONSE)
                return
            }

            /* Some expected file was not found. We will return a RETRY code and move on. */
            if ((err.result === "Fail Because" && err.message === "File does not exist.") || err.code === 'The specified key does not exist.') {
                TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                    "[ERROR] File not Found. Will Retry the Process Loop.")
                callBackFunction(TS.projects.superalgos.globals.standardResponses.DEFAULT_RETRY_RESPONSE)
                return
            }

            /* Some other handled exception occured. We return Fail and move on. */
            if (err.result !== TS.projects.superalgos.globals.standardResponses.DEFAULT_OK_RESPONSE.result) {
                TS.projects.superalgos.globals.processVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).UNEXPECTED_ERROR = err
                TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT.write(MODULE_NAME,
                    "[ERROR] start -> Handled Exception. Will Abort this process. err = " + err.message)
                callBackFunction(TS.projects.superalgos.globals.standardResponses.DEFAULT_FAIL_RESPONSE)
                return
            }
        }
    }
}
