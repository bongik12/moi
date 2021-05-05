exports.newFileStorage = function newFileStorage(processIndex, host, port) {

    const ip = require("ip");
    const MODULE_NAME = 'FileStorage'
    const MAX_RETRY = 10
    const FAST_RETRY_TIME_IN_MILISECONDS = 500
    const SLOW_RETRY_TIME_IN_MILISECONDS = 2000

    let thisObject = {
        asyncGetTextFile: asyncGetTextFile,
        asyncCreateTextFile: asyncCreateTextFile, 
        getTextFile: getTextFile,
        createTextFile: createTextFile,
        deleteTextFile: deleteTextFile
    }

    
    let logger
    if (TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT === undefined) { // Dummy logger
        logger = {}
        function write() {

        }
        logger.write = write
    } else {
        logger = TS.projects.superalgos.globals.loggerVariables.VARIABLES_BY_PROCESS_INDEX_MAP.get(processIndex).BOT_MAIN_LOOP_LOGGER_MODULE_OBJECT
    }
    return thisObject

    async function asyncGetTextFile(filePath, noRetry, canUsePrevious) {
        /* This function allows its caller to work with async / await instead of callbacks */
        let promise = new Promise((resolve, reject) => {

            getTextFile(filePath, onFileRead, noRetry, canUsePrevious) 
            function onFileRead(err, text) {
 
                let response = {
                    err: err,
                    text: text
                }
                resolve(response)
            }
          })

        return promise
    }

    async function asyncCreateTextFile(filePath, fileContent, keepPrevious, noTemp) {
        /* This function allows its caller to work with async / await instead of callbacks */
        let promise = new Promise((resolve, reject) => {

            createTextFile(filePath, fileContent, onFileWriten, keepPrevious, noTemp) 
            function onFileWriten(err) {
 
                let response = {
                    err: err
                }
                resolve(response)
            }
          })

        return promise
    }

    function getTextFile(filePath, callBackFunction, noRetry, canUsePrevious) {

        let currentRetryGetTextFile = 0

        recursiveGetTextFile(filePath, callBackFunction, noRetry, canUsePrevious)

        function recursiveGetTextFile(filePath, callBackFunction, noRetry, canUsePrevious) {
            let fileDoesNotExist = false

            /* Choose path for either bots or data */
            let fileLocation
            let mustBeJason
            if (filePath.indexOf("/bots/") > 0) {
                fileLocation = global.env.PATH_TO_PROJECTS + '/' + filePath
                mustBeJason = false
            } else {
                fileLocation = global.env.PATH_TO_DATA_STORAGE + '/' + filePath
                mustBeJason = true
            }

            try {

                logger.write(MODULE_NAME, '[INFO] FileStorage -> getTextFile -> fileLocation: ' + fileLocation)

                /* Here we actually reaad the file. */
                if (host === undefined || host === 'localhost' || host === ip.address() || host === '127.0.0.1') {
                    /* We read the file from the local file system. */
                    const fs = require('fs')
                    fs.readFile(fileLocation, onFileRead)
                } else {
                    /* We read the file via a web server over http */
                    getFileViaHTTP(fileLocation, onFileRead, callBackFunction)
                }

                function onFileRead(err, text) {
                    let retryTimeToUse = FAST_RETRY_TIME_IN_MILISECONDS
                    if (currentRetryGetTextFile > MAX_RETRY - 2) {
                        retryTimeToUse = SLOW_RETRY_TIME_IN_MILISECONDS
                    }
                    if (err) {

                        if (err.code === 'ENOENT') { // since files are deleted before being replaced, it can happen that it does not exist and after a retry it does.
                            if (noRetry === true) {
                                logger.write(MODULE_NAME, '[WARN] FileStorage -> getTextFile -> onFileRead -> File does not exist. Not Retrying. ')
                                let customResponse = {
                                    result: TS.projects.superalgos.globals.standardResponses.CUSTOM_FAIL_RESPONSE.result,
                                    message: 'File does not exist.'
                                }
                                callBackFunction(customResponse)
                                return
                            }

                            fileDoesNotExist = true
                            logger.write(MODULE_NAME, '[WARN] FileStorage -> getTextFile -> onFileRead -> File does not exist. Retrying. ')
                            setTimeout(retry, retryTimeToUse)
                            return
                        }

                        logger.write(MODULE_NAME, '[WARN] FileStorage -> getTextFile -> onFileRead -> Error reading file -> err = ' + err.stack)
                        logger.write(MODULE_NAME, '[WARN] FileStorage -> getTextFile -> onFileRead -> Error reading file -> filePath = ' + filePath)
                        logger.write(MODULE_NAME, '[WARN] FileStorage -> getTextFile -> onFileRead -> Error reading file -> err = ' + err.stack)
                        setTimeout(retry, retryTimeToUse)
                        return
                    }

                    /*
                    It might happen that we try to read a file just at the moment it is being written by another process. It that case we might get
                    an empty file. If we are not allowed to use the Previous version of the file in this case, then we will retry to read it again
                    a little bit later.
                    */
                    if (text.toString() === "" && canUsePrevious !== true) {
                        logger.write(MODULE_NAME, '[WARN] FileStorage -> getTextFile -> onFileRead -> Read and Empty File -> filePath = ' + filePath)
                        setTimeout(retry, retryTimeToUse)
                        return
                    }

                    if (mustBeJason === false) {
                        /* In this case there is nothing else to check. */
                        callBackFunction(TS.projects.superalgos.globals.standardResponses.DEFAULT_OK_RESPONSE, text.toString())
                        return
                    }

                    /*
                    We are going to check if the file is a valir JSON object
                    */
                    try {
                        let jsonCheck = JSON.parse(text.toString())

                        /* The file was correctly read and could be parsed. */
                        callBackFunction(TS.projects.superalgos.globals.standardResponses.DEFAULT_OK_RESPONSE, text.toString())
                        return

                    } catch (err) {

                        if (canUsePrevious === true) {
                            logger.write(MODULE_NAME, '[WARN] FileStorage -> getTextFile -> onFileRead -> Could read the file, but could not parse it as it is not a valid JSON. Will try to read the PREVIOUS version instead. -> file = ' + fileLocation)

                            if (host === undefined || host === 'localhost' || host === ip.address() || host === '127.0.0.1') {
                                /* We read the file from the local file system. */
                                const fs = require('fs')
                                fs.readFile(fileLocation + '.Previous.json', onPreviousFileRead)
                            } else {
                                /* We read the file via a web server over http */
                                getFileViaHTTP(fileLocation + '.Previous.json', onPreviousFileRead, callBackFunction)
                            }

                            function onPreviousFileRead(err, text) {

                                if (err) {
                                    logger.write(MODULE_NAME, '[WARN] FileStorage -> getTextFile -> onFileRead -> canUsePrevious -> Could not read the Previous file either. Giving up.')
                                    logger.write(MODULE_NAME, '[WARN] FileStorage -> getTextFile -> onFileRead -> canUsePrevious -> err = ' + err.stack)
                                    callBackFunction(TS.projects.superalgos.globals.standardResponses.DEFAULT_FAIL_RESPONSE)
                                    return
                                }

                                /* Returning the previous file */
                                callBackFunction(TS.projects.superalgos.globals.standardResponses.DEFAULT_OK_RESPONSE, text.toString())
                                return
                            }
                        } else {
                            logger.write(MODULE_NAME, '[WARN] FileStorage -> getTextFile -> onFileRead -> Could read the file, but could not parse it as it is not a valid JSON.')
                            logger.write(MODULE_NAME, '[WARN] FileStorage -> getTextFile -> onFileRead -> err = ' + err.stack)
                            logger.write(MODULE_NAME, '[WARN] FileStorage -> getTextFile -> onFileRead -> text.toString() = ' + text.toString())
                            setTimeout(retry, retryTimeToUse)
                            return
                        }
                    }
                }

            } catch (err) {
                logger.write(MODULE_NAME, '[WARN] FileStorage -> getTextFile -> Error reading file -> file = ' + fileLocation)
                logger.write(MODULE_NAME, '[WARN] FileStorage -> getTextFile -> Error reading file -> err = ' + err.stack)
                retry()
            }

            function retry() {
                if (currentRetryGetTextFile < MAX_RETRY) {
                    currentRetryGetTextFile++
                    logger.write(MODULE_NAME, '[INFO] FileStorage -> getTextFile -> retry -> Will try to read the file again -> Retry #: ' + currentRetryGetTextFile)
                    recursiveGetTextFile(filePath, callBackFunction, noRetry, canUsePrevious)
                } else {
                    currentRetryGetTextFile = 0

                    if (fileDoesNotExist === true) {
                        logger.write(MODULE_NAME, '[WARN] FileStorage -> getTextFile -> retry -> Max retries reached reading a file. File Not Found.')
                        let customResponse = {
                            result: TS.projects.superalgos.globals.standardResponses.CUSTOM_FAIL_RESPONSE.result,
                            message: 'File does not exist.'
                        }
                        callBackFunction(customResponse)
                        return
                    } else {

                        logger.write(MODULE_NAME, '[ERROR] FileStorage -> getTextFile -> retry -> Max retries reached reading a file. Giving up.')
                        logger.write(MODULE_NAME, '[ERROR] FileStorage -> getTextFile -> retry -> file = ' + fileLocation)
                        callBackFunction(TS.projects.superalgos.globals.standardResponses.DEFAULT_FAIL_RESPONSE)
                        return
                    }
                }
            }
        }
    }

    function createTextFile(filePath, fileContent, callBackFunction, keepPrevious, noTemp) {

        let currentRetryWriteTextFile = 0

        recursiveCreateTextFile(filePath, fileContent, callBackFunction, keepPrevious, noTemp)

        function recursiveCreateTextFile(filePath, fileContent, callBackFunction, keepPrevious, noTemp) {
            /* Choose path for either logs or data */
            let fileLocation
            if (filePath.indexOf("/Logs/") > 0) {
                fileLocation = global.env.PATH_TO_LOG_FILES + '/' + filePath
            } else {
                fileLocation = global.env.PATH_TO_DATA_STORAGE + '/' + filePath
            }

            try {
                logger.write(MODULE_NAME, '[INFO] FileStorage -> createTextFile -> fileLocation: ' + fileLocation)

                /* If necesary a folder or folders are created before writing the file to disk. */
                TS.projects.superalgos.utilities.miscellaneousFunctions.mkDirByPathSync(fileLocation)

                /*
                Here we write the file with a temporary name so as to avoid dirty read from other processes.
                Then we delete the original file, if exists, and finally we rename the temporary into the original name.
                */
                const fs = require('fs')
                if (noTemp === true) {
                    fs.writeFile(fileLocation, fileContent, onFileWriten)
                } else {
                    fs.writeFile(fileLocation + '.tmp', fileContent, onFileWriten)
                }

                function onFileWriten(err) {
                    let retryTimeToUse = FAST_RETRY_TIME_IN_MILISECONDS
                    if (currentRetryWriteTextFile > MAX_RETRY - 2) {
                        retryTimeToUse = SLOW_RETRY_TIME_IN_MILISECONDS
                    }
                    if (err) {
                        logger.write(MODULE_NAME, '[WARN] FileStorage -> createTextFile -> onFileWriten -> Error writing file -> file = ' + fileLocation + '.tmp')
                        logger.write(MODULE_NAME, '[WARN] FileStorage -> createTextFile -> onFileWriten -> Error writing file -> err = ' + err.stack)
                        setTimeout(retry, retryTimeToUse)
                    } else {

                        if (noTemp === true) {
                            callBackFunction(TS.projects.superalgos.globals.standardResponses.DEFAULT_OK_RESPONSE)
                            return
                        }
                        if (keepPrevious === true) {
                            /*
                            In some cases, we are going to keep a copy of the previous version of the file being written. This will be usefull to recover from crashes
                            when the file written gets corrupted for any reason.
                            */
                            fs.unlink(fileLocation + '.Previous.json', onUnlinked)

                            function onUnlinked(err) {
                                let code = ''
                                if (err) {
                                    code = err.code
                                }
                                if (code !== '' && code !== 'ENOENT') {
                                    logger.write(MODULE_NAME, '[WARN] FileStorage -> createTextFile -> onFileWriten -> onUnlinked -> Error deleting file -> file = ' + fileLocation + '.Previous.json')
                                    logger.write(MODULE_NAME, '[WARN] FileStorage -> createTextFile -> onFileWriten -> onUnlinked -> Error deleting file -> err = ' + err.stack)
                                    setTimeout(retry, retryTimeToUse)
                                    return
                                }

                                /* Rename de Original into Previous */
                                fs.rename(fileLocation, fileLocation + '.Previous.json', onOriginalRenamed)

                                function onOriginalRenamed(err) {
                                    let code = ''
                                    if (err) {
                                        code = err.code
                                    }
                                    if (code !== '' && code !== 'ENOENT') { // Unless the file does not exists we do this...
                                        logger.write(MODULE_NAME, '[WARN] FileStorage -> createTextFile -> onFileWriten -> onUnlinked -> onOriginalRenamed -> Error renaming original file -> file = ' + fileLocation)
                                        logger.write(MODULE_NAME, '[WARN] FileStorage -> createTextFile -> onFileWriten -> onUnlinked -> onOriginalRenamed -> Error renaming original file -> err = ' + err.stack)
                                        setTimeout(retry, retryTimeToUse)
                                        return
                                    }

                                    /* Rename de Temp into Original */
                                    fs.rename(fileLocation + '.tmp', fileLocation, onTempRenamed)

                                    function onTempRenamed(err) {
                                        if (err) {
                                            logger.write(MODULE_NAME, '[WARN] FileStorage -> createTextFile -> onFileWriten -> onUnlinked -> onOriginalRenamed -> onTempRenamed -> Error renaming temp file -> file = ' + fileLocation + '.tmp')
                                            logger.write(MODULE_NAME, '[WARN] FileStorage -> createTextFile -> onFileWriten -> onUnlinked -> onOriginalRenamed -> onTempRenamed -> Error renaming temp file -> err = ' + err.stack)
                                            setTimeout(retry, retryTimeToUse)
                                        } else {

                                            callBackFunction(TS.projects.superalgos.globals.standardResponses.DEFAULT_OK_RESPONSE)

                                        }
                                    }
                                }
                            }
                        } else {

                            /* In this case, there is no need to keep a copy of the file being replaced, so we just delete and that's it. */
                            fs.unlink(fileLocation, onUnlinked)

                            function onUnlinked(err) {
                                let code = ''
                                if (err) {
                                    code = err.code
                                }
                                if (code !== '' && code !== 'ENOENT') {
                                    logger.write(MODULE_NAME, '[WARN] FileStorage -> createTextFile -> onFileWriten -> onUnlinked -> Error deleting file -> file = ' + fileLocation)
                                    logger.write(MODULE_NAME, '[WARN] FileStorage -> createTextFile -> onFileWriten -> onUnlinked -> Error deleting file -> err = ' + err.stack)
                                    setTimeout(retry, retryTimeToUse)
                                    return
                                }

                                /* Rename de Temp into Original */
                                fs.rename(fileLocation + '.tmp', fileLocation, onTempRenamed)

                                function onTempRenamed(err) {
                                    if (err) {
                                        logger.write(MODULE_NAME, '[WARN] FileStorage -> createTextFile -> onFileWriten -> onUnlinked -> onOriginalRenamed -> onTempRenamed -> Error renaming temp file -> file = ' + fileLocation + '.tmp')
                                        logger.write(MODULE_NAME, '[WARN] FileStorage -> createTextFile -> onFileWriten -> onUnlinked -> onOriginalRenamed -> onTempRenamed -> Error renaming temp file -> err = ' + err.stack)
                                        setTimeout(retry, retryTimeToUse)
                                    } else {

                                        callBackFunction(TS.projects.superalgos.globals.standardResponses.DEFAULT_OK_RESPONSE)

                                    }
                                }
                            }
                        }
                    }
                }

            } catch (err) {
                logger.write(MODULE_NAME, '[WARN] FileStorage -> createTextFile -> Error writing file -> file = ' + fileLocation)
                logger.write(MODULE_NAME, '[WARN] FileStorage -> createTextFile -> Error writing file -> err = ' + err.stack)
                retry()
            }

            function retry() {
                if (currentRetryWriteTextFile < MAX_RETRY) {
                    currentRetryWriteTextFile++
                    logger.write(MODULE_NAME, '[INFO] FileStorage -> createTextFile -> retry -> Will try to write the file again -> Retry #: ' + currentRetryWriteTextFile)
                    recursiveCreateTextFile(filePath, fileContent, callBackFunction, keepPrevious)
                } else {
                    currentRetryWriteTextFile = 0
                    logger.write(MODULE_NAME, '[ERROR] FileStorage -> createTextFile -> retry -> Max retries reached writting a file. Giving up.')
                    logger.write(MODULE_NAME, '[ERROR] FileStorage -> createTextFile -> retry -> file = ' + fileLocation)
                    callBackFunction(TS.projects.superalgos.globals.standardResponses.DEFAULT_FAIL_RESPONSE)
                }
            }
        }
    }

    function deleteTextFile(filePath, callBackFunction) {

        let currentRetryDeleteTextFile = 0

        recursiveDeleteTextFile(filePath, callBackFunction)

        function recursiveDeleteTextFile(filePath, callBackFunction) {
            logger.write(MODULE_NAME, '[INFO] FileStorage -> deleteTextFile -> Entering Function.')

            /* Choose path for either logs or data */
            let fileLocation
            if (filePath.indexOf("/Logs/") > 0) {
                fileLocation = global.env.PATH_TO_LOG_FILES + '/' + filePath
            } else {
                fileLocation = global.env.PATH_TO_DATA_STORAGE + '/' + filePath
            }

            try {

                logger.write(MODULE_NAME, '[INFO] FileStorage -> deleteTextFile -> fileLocation: ' + fileLocation)

                const fs = require('fs')
                fs.unlink(fileLocation, onUnlinked)

                function onUnlinked(err) {
                    let retryTimeToUse = FAST_RETRY_TIME_IN_MILISECONDS
                    if (currentRetryDeleteTextFile > MAX_RETRY - 2) {
                        retryTimeToUse = SLOW_RETRY_TIME_IN_MILISECONDS
                    }
                    if (err) {
                        if (callBackFunction !== undefined) {
                            callBackFunction(TS.projects.superalgos.globals.standardResponses.DEFAULT_FAIL_RESPONSE)
                        }
                    } else {
                        setTimeout(retry, retryTimeToUse)
                    }
                }
            } catch (err) {
                logger.write(MODULE_NAME, '[WARN] FileStorage -> deleteTextFile -> Error writing file -> file = ' + fileLocation)
                logger.write(MODULE_NAME, '[WARN] FileStorage -> deleteTextFile -> Error writing file -> err = ' + err.stack)
                if (callBackFunction !== undefined) {
                    callBackFunction(TS.projects.superalgos.globals.standardResponses.DEFAULT_FAIL_RESPONSE)
                }
            }

            function retry() {
                if (currentRetryDeleteTextFile < MAX_RETRY) {
                    currentRetryDeleteTextFile++
                    logger.write(MODULE_NAME, '[INFO] FileStorage -> deleteTextFile -> retry -> Will try to delete the file again -> Retry #: ' + currentRetryDeleteTextFile)
                    recursiveDeleteTextFile(filePath, callBackFunction)
                } else {
                    currentRetryDeleteTextFile = 0
                    logger.write(MODULE_NAME, '[ERROR] FileStorage -> deleteTextFile -> retry -> Max retries reached deleting a file. Giving up.')
                    logger.write(MODULE_NAME, '[ERROR] FileStorage -> deleteTextFile -> retry -> file = ' + fileLocation)
                    if (callBackFunction !== undefined) {
                        callBackFunction(TS.projects.superalgos.globals.standardResponses.DEFAULT_OK_RESPONSE)
                    }
                }
            }
        }
    }

    function getFileViaHTTP(filePath, callback, callBackFunction) {
        try {

            /* The filePath received is the one that is needed to fetch data from with fs. To do it via http we need to remove the prefix that includes this: ./Data-Storage/  */
            filePath = filePath.substring(15, filePath.length)

            let http = require('http');
            let url = 'http://' + host +
                ':' + port +
                '/Storage/' +
                filePath

            logger.write(MODULE_NAME, '[INFO] FileStorage -> getFileViaHTTP -> url = ' + url)

            let request = http.get(url, onResponse);

            request.on('error', function (err) {
                logger.write(MODULE_NAME, "[ERROR] getFileViaHTTP -> onError -> err = " + err.stack);
                logger.write(MODULE_NAME, "[ERROR] getFileViaHTTP -> onError -> Failed to fetch file via HTTP. Will retry later. ");
                callBackFunction(TS.projects.superalgos.globals.standardResponses.DEFAULT_RETRY_RESPONSE);
            })

            function onResponse(response) {

                try {
                    const chunks = []

                    response.on('data', onMessegesArrived)
                    response.on('end', onEnd)

                    function onMessegesArrived(chunk) {
                        chunks.push(chunk)
                    }

                    function onEnd() {
                        let fileContent = Buffer.concat(chunks).toString('utf8')
                        let err = null
                        if (fileContent.indexOf('does not exist') >= 0) {
                            err = {
                                code: "ENOENT" // This is how fs would have returned upon this situation.
                            }
                            fileContent = undefined
                        }
                        callback(err, fileContent)
                    }
                } catch (err) {
                    logger.write(MODULE_NAME, "[ERROR] getFileViaHTTP -> onResponse -> err = " + err.stack);
                    logger.write(MODULE_NAME, "[ERROR] getFileViaHTTP -> onResponse -> Failed to fetch file via HTTP. Will retry later. ");
                    callBackFunction(TS.projects.superalgos.globals.standardResponses.DEFAULT_RETRY_RESPONSE);
                }
            }
        } catch (err) {
            logger.write(MODULE_NAME, "[ERROR] getFileViaHTTP -> err = " + err.stack);
            logger.write(MODULE_NAME, "[ERROR] getFileViaHTTP -> Failed to fetch file via HTTP. Will retry later. ");
            callBackFunction(TS.projects.superalgos.globals.standardResponses.DEFAULT_RETRY_RESPONSE);
        }
    }
}
