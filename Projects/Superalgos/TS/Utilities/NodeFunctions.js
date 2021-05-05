exports.newSuperalgosUtilitiesNodeFunctions = function () {

    let thisObject = {
        nodeBranchToArray: nodeBranchToArray,
        findNodeInNodeMesh: findNodeInNodeMesh,
        nodeMeshToPathArray: nodeMeshToPathArray,
        findNodeInNodeArray: findNodeInNodeArray,
        filterOutNodeWihtoutReferenceParentFromNodeArray: filterOutNodeWihtoutReferenceParentFromNodeArray
    }

    return thisObject

    function nodeBranchToArray(node, nodeType) {
        let resultArray = []
        scanNodeBranch(node, nodeType)
        return resultArray

        function scanNodeBranch(startingNode) {
            let schemaDocument = TS.projects.superalgos.globals.taskConstants.APP_SCHEMA_MAP.get(startingNode.project + '-' + startingNode.type)
            if (schemaDocument === undefined) { return }

            if (startingNode.type === nodeType) {
                resultArray.push(startingNode)
                return
            }

            if (schemaDocument.childrenNodesProperties === undefined) { return }
            for (let i = 0; i < schemaDocument.childrenNodesProperties.length; i++) {
                let property = schemaDocument.childrenNodesProperties[i]

                switch (property.type) {
                    case 'node': {
                        scanNodeBranch(startingNode[property.name])
                    }
                        break
                    case 'array': {
                        let startingNodePropertyArray = startingNode[property.name]
                        if (startingNodePropertyArray !== undefined) {
                            for (let m = 0; m < startingNodePropertyArray.length; m++) {
                                scanNodeBranch(startingNodePropertyArray[m])
                            }
                        }
                        break
                    }
                }
            }
        }
    }

    function findNodeInNodeMesh (node, nodeType) {
        /*
        This function scans a node mesh for a certain node type and 
        returns the first instance found. 
        */
        let nodeFound
        scanNodeMesh(node, nodeType)
        return nodeFound

        function scanNodeMesh(startingNode) {
            if (startingNode === undefined) { return }
            if (nodeFound !== undefined) { return }

            let schemaDocument = TS.projects.superalgos.globals.taskConstants.APP_SCHEMA_MAP.get(startingNode.project + '-' + startingNode.type)
            if (schemaDocument === undefined) { return }

            if (startingNode.type === nodeType) {
                nodeFound = startingNode
                return
            }

            /* We scan through this node children */
            if (schemaDocument.childrenNodesProperties !== undefined) {
                for (let i = 0; i < schemaDocument.childrenNodesProperties.length; i++) {
                    let property = schemaDocument.childrenNodesProperties[i]

                    switch (property.type) {
                        case 'node': {
                            scanNodeMesh(startingNode[property.name])
                        }
                            break
                        case 'array': {
                            let startingNodePropertyArray = startingNode[property.name]
                            if (startingNodePropertyArray !== undefined) {
                                for (let m = 0; m < startingNodePropertyArray.length; m++) {
                                    scanNodeMesh(startingNodePropertyArray[m])
                                }
                            }
                            break
                        }
                    }
                }
            }
            /* We scan parents nodes. */
            if (startingNode.parentNode !== undefined) {
                scanNodeMesh(startingNode.parentNode)
            }
            /* We scan reference parents too. */
            if (startingNode.referenceParent !== undefined) {
                scanNodeMesh(startingNode.referenceParent)
            }
        }
    }

    function nodeMeshToPathArray (node, nodeId) {
        /*
        This function scans a node mesh for a certain node id and 
        returns an array with the path within that mesh to the
        requested node. 
        */
        let nodeArray = []
        scanNodeMesh(node)
        return nodeArray

        function scanNodeMesh(startingNode) {
            if (startingNode === undefined) { return }

            let schemaDocument = TS.projects.superalgos.globals.taskConstants.APP_SCHEMA_MAP.get(startingNode.project + '-' + startingNode.type)
            if (schemaDocument === undefined) { return }

            if (startingNode.id === nodeId) {
                nodeArray.push(startingNode)
                return
            }

            /* We scan through this node children */
            if (schemaDocument.childrenNodesProperties !== undefined) {
                for (let i = 0; i < schemaDocument.childrenNodesProperties.length; i++) {
                    let property = schemaDocument.childrenNodesProperties[i]

                    switch (property.type) {
                        case 'node': {
                            scanNodeMesh(startingNode[property.name])
                            if (nodeArray.length > 0) {
                                nodeArray.unshift(startingNode)
                                return
                            }
                        }
                            break
                        case 'array': {
                            let startingNodePropertyArray = startingNode[property.name]
                            if (startingNodePropertyArray !== undefined) {
                                for (let m = 0; m < startingNodePropertyArray.length; m++) {
                                    scanNodeMesh(startingNodePropertyArray[m])
                                    if (nodeArray.length > 0) {
                                        nodeArray.unshift(startingNode)
                                        return
                                    }
                                }
                            }
                            break
                        }
                    }
                }
            }
            /* We scan parents nodes. */
            if (startingNode.parentNode !== undefined) {
                scanNodeMesh(startingNode.parentNode)
                if (nodeArray.length > 0) {
                    nodeArray.unshift(startingNode)
                    return
                }
            }
            /* We scan reference parents too. */
            if (startingNode.referenceParent !== undefined) {
                scanNodeMesh(startingNode.referenceParent)
                if (nodeArray.length > 0) {
                    nodeArray.unshift(startingNode)
                    return
                }
            }
        }
    }

    function findNodeInNodeArray (nodeArray, nodeType) {
        for (let i = 0; i < nodeArray.length; i++) {
            let node = nodeArray[i]
            if (node.type === nodeType) {
                return node
            }
        }
    }

    function filterOutNodeWihtoutReferenceParentFromNodeArray (nodeArray) {
        let filteredNodeArray = []
        for (let i = 0; i < nodeArray.length; i++) {
            let arrayItem = nodeArray[i]
            if (arrayItem.referenceParent === undefined) {
                continue
            } else {
                filteredNodeArray.push(arrayItem)
            }
        }
        return filteredNodeArray
    }
}