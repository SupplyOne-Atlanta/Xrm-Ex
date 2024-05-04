/// <reference path="../node_modules/@types/xrm/index.d.ts" />
var XrmEx;
(function (XrmEx) {
    /**
     * Throws an error with the given error message.
     * @param {string} errorMessage - The error message to throw.
     * @throws {Error} - Always throws an error with the given error message.
     */
    function throwError(errorMessage) {
        throw new Error(errorMessage);
    }
    XrmEx.throwError = throwError;
    /**
     * Returns current state of client whether it's online or offline. This method
     * is of qustionable usefulness for it provides little to no benefit over using
     * the native Xrm SDK method. You decide, dear programmer!
     * @returns boolean
     */
    function isOffline() {
        return Xrm.Utility.getGlobalContext().client.isOffline();
    }
    XrmEx.isOffline = isOffline;
    /**
     * Returns the name of the calling function.
     * @returns {string} - The name of the calling function.
     */
    function getFunctionName() {
        try {
            const error = new Error();
            const stackTrace = error.stack?.split("\n").map((line) => line.trim());
            const callingFunctionLine = stackTrace && stackTrace.length >= 3 ? stackTrace[2] : undefined;
            const functionNameMatch = callingFunctionLine?.match(/at\s+([^\s]+)\s+\(/) ||
                callingFunctionLine?.match(/at\s+([^\s]+)/);
            const functionName = functionNameMatch ? functionNameMatch[1] : "";
            return functionName;
        }
        catch (error) {
            throw new Error(`XrmEx.getFunctionName:\n${error.message}`);
        }
    }
    XrmEx.getFunctionName = getFunctionName;
    /**
     * Displays a notification for an app with the given message and level, and lets you specify whether to show a close button.
     * @param {string} message - The message to display in the notification.
     * @param {'SUCCESS' | 'ERROR' | 'WARNING' | 'INFO'} level - The level of the notification. Can be 'SUCCESS', 'ERROR', 'WARNING', or 'INFO'.
     * @param {boolean} [showCloseButton=false] - Whether to show a close button on the notification. Defaults to false.
     * @returns {Promise<string>} - A promise that resolves with the ID of the created notification.
     */
    async function addGlobalNotification(message, level, showCloseButton = false) {
        const levelMap = {
            SUCCESS: 1,
            ERROR: 2,
            WARNING: 3,
            INFO: 4,
        };
        const messageLevel = levelMap[level] || levelMap.INFO;
        const notification = {
            type: 2,
            level: messageLevel,
            message,
            showCloseButton,
        };
        try {
            return await Xrm.App.addGlobalNotification(notification);
        }
        catch (error) {
            throw new Error(`XrmEx.${getFunctionName()}:\n${error.message}`);
        }
    }
    XrmEx.addGlobalNotification = addGlobalNotification;
    /**
     * Clears a notification in the app with the given unique ID.
     * @param {string} uniqueId - The unique ID of the notification to clear.
     * @returns {Promise<string>} - A promise that resolves when the notification has been cleared.
     */
    async function removeGlobalNotification(uniqueId) {
        try {
            return await Xrm.App.clearGlobalNotification(uniqueId);
        }
        catch (error) {
            throw new Error(`XrmEx.${getFunctionName()}:\n${error.message}`);
        }
    }
    XrmEx.removeGlobalNotification = removeGlobalNotification;
    /**
     * Retrieves the value of an environment variable by using its schema name as key.
     * If the environment variable has both a default value and a current value, this function will retrieve the current value.
     * @param {string} environmentVariableSchemaName - The schema name of the environment variable to retrieve.
     * @returns {Promise<string>} - A promise that resolves with the value of the environment variable.
     * @async
     */
    async function getEnvironmentVariableValue(environmentVariableSchemaName) {
        let response = await executeFunction("RetrieveEnvironmentVariableValue", [
            {
                Name: "DefinitionSchemaName",
                Type: "String",
                Value: environmentVariableSchemaName,
            },
        ]);
        return Object.hasOwn(response, "Value") ? response.Value : response;
    }
    XrmEx.getEnvironmentVariableValue = getEnvironmentVariableValue;
    /**
     * A map of CRM data types to their corresponding type names, structural properties, and JavaScript types.
     * @type {Object.<string, { typeName: string, structuralProperty: number, jsType: string }>}
     */
    let typeMap = {
        String: { typeName: "Edm.String", structuralProperty: 1, jsType: "string" },
        Integer: { typeName: "Edm.Int32", structuralProperty: 1, jsType: "number" },
        Boolean: {
            typeName: "Edm.Boolean",
            structuralProperty: 1,
            jsType: "boolean",
        },
        DateTime: {
            typeName: "Edm.DateTimeOffset",
            structuralProperty: 1,
            jsType: "object",
        },
        EntityReference: {
            typeName: "mscrm.crmbaseentity",
            structuralProperty: 5,
            jsType: "object",
        },
        Decimal: {
            typeName: "Edm.Decimal",
            structuralProperty: 1,
            jsType: "number",
        },
        Entity: {
            typeName: "mscrm.crmbaseentity",
            structuralProperty: 5,
            jsType: "object",
        },
        EntityCollection: {
            typeName: "Collection(mscrm.crmbaseentity)",
            structuralProperty: 4,
            jsType: "object",
        },
        Float: { typeName: "Edm.Double", structuralProperty: 1, jsType: "number" },
        Money: { typeName: "Edm.Decimal", structuralProperty: 1, jsType: "number" },
        Picklist: {
            typeName: "Edm.Int32",
            structuralProperty: 1,
            jsType: "number",
        },
    };
    /**
     * Checks if the given request parameter is of a supported type and has a valid value.
     * @param {RequestParameter} requestParameter - The request parameter to check.
     * @returns {void}
     * @throws {Error} - Throws an error if the request parameter is not of a supported type or has an invalid value.
     */
    function checkRequestParameterType(requestParameter) {
        if (!typeMap[requestParameter.Type])
            throw new Error(`The property type ${requestParameter.Type} of the property ${requestParameter.Name} is not supported.`);
        const expectedType = typeMap[requestParameter.Type].jsType;
        const actualType = typeof requestParameter.Value;
        const invalidTypeMessage = `The value ${requestParameter.Value}\nof the property ${requestParameter.Name}\nis not of the expected type ${requestParameter.Type}.`;
        if (requestParameter.Type === "EntityReference" ||
            requestParameter.Type === "Entity") {
            if (!requestParameter.Value ||
                !requestParameter.Value.hasOwnProperty("id") ||
                !requestParameter.Value.hasOwnProperty("entityType")) {
                throw new Error(invalidTypeMessage);
            }
            typeMap[requestParameter.Type].typeName = `mscrm.${requestParameter.Value.entityType}`;
        }
        else if (requestParameter.Type === "EntityCollection") {
            if (!Array.isArray(requestParameter.Value) ||
                requestParameter.Value.every((v) => typeof v !== "object" ||
                    !v ||
                    !v.hasOwnProperty("id") ||
                    !v.hasOwnProperty("entityType"))) {
                throw new Error(invalidTypeMessage);
            }
        }
        else if (requestParameter.Type === "DateTime") {
            if (!(requestParameter.Value instanceof Date)) {
                throw new Error(invalidTypeMessage);
            }
        }
        else {
            if (actualType !== expectedType) {
                throw new Error(invalidTypeMessage);
            }
        }
    }
    XrmEx.checkRequestParameterType = checkRequestParameterType;
    /**
     * Executes an Action.
     * @param {string} actionName - The unique name of the action.
     * @param {RequestParameter[]} requestParameters - An array of objects with the parameter name, type and value.
     * @param {EntityReference} [boundEntity] - An optional EntityReference of the bound entity.
     * @returns {Promise<any>} - A Promise with the request response.
     * @throws {Error} - Throws an error if the request parameter is not of a supported type or has an invalid value.
     */
    async function executeAction(actionName, requestParameters, boundEntity) {
        const parameterDefinition = {};
        if (boundEntity)
            requestParameters.push({
                Name: "entity",
                Value: boundEntity,
                Type: "EntityReference",
            });
        for (const requestParameter of requestParameters) {
            checkRequestParameterType(requestParameter);
            parameterDefinition[requestParameter.Name] = {
                typeName: typeMap[requestParameter.Type].typeName,
                structuralProperty: typeMap[requestParameter.Type].structuralProperty,
            };
        }
        const req = Object.assign({
            getMetadata: () => ({
                boundParameter: boundEntity ? "entity" : null,
                operationType: 0,
                operationName: actionName,
                parameterTypes: parameterDefinition,
            }),
        }, ...requestParameters.map((p) => ({ [p.Name]: p.Value })));
        const response = await Xrm.WebApi.online.execute(req);
        if (response.ok)
            return response.json().catch(() => response);
    }
    XrmEx.executeAction = executeAction;
    /**
     * Executes a Function.
     * @param {string} functionName - The unique name of the function.
     * @param {RequestParameter[]} requestParameters - An array of objects with the parameter name, type and value.
     * @param {EntityReference} [boundEntity] - An optional EntityReference of the bound entity.
     * @returns {Promise<any>} - A Promise with the request response.
     * @throws {Error} - Throws an error if the request parameter is not of a supported type or has an invalid value.
     */
    async function executeFunction(functionName, requestParameters, boundEntity) {
        const parameterDefinition = {};
        if (boundEntity)
            requestParameters.push({
                Name: "entity",
                Value: boundEntity,
                Type: "EntityReference",
            });
        for (const requestParameter of requestParameters) {
            checkRequestParameterType(requestParameter);
            parameterDefinition[requestParameter.Name] = {
                typeName: typeMap[requestParameter.Type].typeName,
                structuralProperty: typeMap[requestParameter.Type].structuralProperty,
            };
        }
        const req = Object.assign({
            getMetadata: () => ({
                boundParameter: boundEntity ? "entity" : null,
                operationType: 1,
                operationName: functionName,
                parameterTypes: parameterDefinition,
            }),
        }, ...requestParameters.map((p) => ({ [p.Name]: p.Value })));
        const response = await Xrm.WebApi.online.execute(req);
        if (response.ok)
            return response.json().catch(() => response);
    }
    XrmEx.executeFunction = executeFunction;
    /**
     * Makes a GUID lowercase and removes brackets.
     * @param {string} guid - The GUID to normalize.
     * @returns {string} - The normalized GUID.
     */
    function normalizeGuid(guid) {
        if (typeof guid !== "string")
            throw new Error(`XrmEx.normalizeGuid:\n'${guid}' is not a string`);
        return guid.toLowerCase().replace(/[{}]/g, "");
    }
    XrmEx.normalizeGuid = normalizeGuid;
    /**
     * Wraps a function that takes a callback as its last parameter and returns a Promise.
     * @param {Function} fn the function to wrap
     * @param context the parent property of the function f.e. formContext.data.process for formContext.data.process.getEnabledProcesses
     * @param args the arguments to pass to the function
     * @returns {Promise<any>} a Promise that resolves with the callback response
     */
    function asPromise(fn, context, ...args) {
        return new Promise((resolve, reject) => {
            const callback = (response) => {
                resolve(response);
            };
            try {
                // Call the function with the arguments and the callback at the end
                fn.call(context, ...args, callback);
            }
            catch (error) {
                reject(error);
            }
        });
    }
    XrmEx.asPromise = asPromise;
    /**
     * Opens a dialog with dynamic height and width based on text content.
     * @param {string} title - The title of the dialog.
     * @param {string} text - The text content of the dialog.
     * @returns {Promise<any>} - A Promise with the dialog response.
     */
    async function openAlertDialog(title, text) {
        try {
            const rows = text.split(/\r\n|\r|\n/);
            let additionalRows = 0;
            rows.forEach((row) => {
                let width = getTextWidth(row, "1rem Segoe UI Regular, SegoeUI, Segoe UI");
                if (width > 940) {
                    additionalRows += width / 940;
                }
            });
            const longestRow = rows.reduce((acc, row) => (row.length > acc.length ? row : acc), "");
            const width = Math.min(getTextWidth(longestRow, "1rem Segoe UI Regular, SegoeUI, Segoe UI"), 1000);
            const height = 109 + (rows.length + additionalRows) * 20;
            return await Xrm.Navigation.openAlertDialog({
                confirmButtonLabel: "Ok",
                text,
                title,
            }, {
                height,
                width,
            });
        }
        catch (error) {
            console.error(error.message);
            throw new Error(`XrmEx.${getFunctionName()}:\n${error.message}`);
        }
        /**
         * Uses canvas.measureText to compute and return the width of the given text of given font in pixels.
         *
         * @param {String} text The text to be rendered.
         * @param {String} font The css font descriptor that text is to be rendered with (e.g. "bold 14px verdana").
         *
         * @see https://stackoverflow.com/questions/118241/calculate-text-width-with-javascript/21015393#21015393
         */
        function getTextWidth(text, font) {
            const canvas = document.createElement("canvas");
            const context = canvas.getContext("2d");
            context.font = font;
            const metrics = context.measureText(text);
            return metrics.width;
        }
    }
    XrmEx.openAlertDialog = openAlertDialog;
    class Process {
        static get data() {
            return Form.formContext.data.process;
        }
        static get ui() {
            return Form.formContext.ui.process;
        }
        /**
         * Use this to add a function as an event handler for the OnPreProcessStatusChange event so that it will be called before the
         * business process flow status changes.
         * @param handler The function will be added to the bottom of the event
         *                handler pipeline. The execution context is automatically
         *                set to be the first parameter passed to the event handler.
         *                Use a reference to a named function rather than an
         *                anonymous function if you may later want to remove the
         *                event handler.
         */
        static addOnPreProcessStatusChange(handler) {
            Form.formContext.data.process.removeOnPreProcessStatusChange(handler);
            return Form.formContext.data.process.addOnPreProcessStatusChange(handler);
        }
        /**
         * Use this to add a function as an event handler for the OnPreStageChange event so that it will be called before the
         * business process flow stage changes.
         * @param handler The function will be added to the bottom of the event
         *                handler pipeline. The execution context is automatically
         *                set to be the first parameter passed to the event handler.
         *                Use a reference to a named function rather than an
         *                anonymous function if you may later want to remove the
         *                event handler.
         */
        static addOnPreStageChange(handler) {
            Form.formContext.data.process.removeOnPreStageChange(handler);
            return Form.formContext.data.process.addOnPreStageChange(handler);
        }
        /**
         * Use this to add a function as an event handler for the OnPreProcessStatusChange event so that it will be called when the
         * business process flow status changes.
         * @param handler The function will be added to the bottom of the event
         *                handler pipeline. The execution context is automatically
         *                set to be the first parameter passed to the event handler.
         *                Use a reference to a named function rather than an
         *                anonymous function if you may later want to remove the
         *                event handler.
         */
        static addOnProcessStatusChange(handler) {
            Form.formContext.data.process.removeOnProcessStatusChange(handler);
            return Form.formContext.data.process.addOnProcessStatusChange(handler);
        }
        /**
         * Use this to add a function as an event handler for the OnStageChange event so that it will be called when the
         * business process flow stage changes.
         * @param handler The function will be added to the bottom of the event
         *                handler pipeline. The execution context is automatically
         *                set to be the first parameter passed to the event handler.
         *                Use a reference to a named function rather than an
         *                anonymous function if you may later want to remove the
         *                event handler.
         */
        static addOnStageChange(handler) {
            Form.formContext.data.process.removeOnStageChange(handler);
            return Form.formContext.data.process.addOnStageChange(handler);
        }
        /**
         * Use this to add a function as an event handler for the OnStageSelected event so that it will be called
         * when a business process flow stage is selected.
         * @param handler The function will be added to the bottom of the event
         *                handler pipeline. The execution context is automatically
         *                set to be the first parameter passed to the event handler.
         *                Use a reference to a named function rather than an
         *                anonymous function if you may later want to remove the
         *                event handler.
         */
        static addOnStageSelected(handler) {
            Form.formContext.data.process.removeOnStageSelected(handler);
            return Form.formContext.data.process.addOnStageSelected(handler);
        }
        /**
         * Use this to remove a function as an event handler for the OnPreProcessStatusChange event.
         * @param handler If an anonymous function is set using the addOnPreProcessStatusChange method it
         *                cannot be removed using this method.
         */
        static removeOnPreProcessStatusChange(handler) {
            return Form.formContext.data.process.removeOnPreProcessStatusChange(handler);
        }
        /**
         * Use this to remove a function as an event handler for the OnPreStageChange event.
         * @param handler If an anonymous function is set using the addOnPreStageChange method it
         *                cannot be removed using this method.
         */
        static removeOnPreStageChange(handler) {
            return Form.formContext.data.process.removeOnPreStageChange(handler);
        }
        /**
         * Use this to remove a function as an event handler for the OnProcessStatusChange event.
         * @param handler If an anonymous function is set using the addOnProcessStatusChange method it
         *                cannot be removed using this method.
         */
        static removeOnProcessStatusChange(handler) {
            return Form.formContext.data.process.removeOnProcessStatusChange(handler);
        }
        /**
         * Use this to remove a function as an event handler for the OnStageChange event.
         * @param handler If an anonymous function is set using the addOnStageChange method it
         *                cannot be removed using this method.
         */
        static removeOnStageChange(handler) {
            return Form.formContext.data.process.removeOnStageChange(handler);
        }
        /**
         * Use this to remove a function as an event handler for the OnStageChange event.
         * @param handler If an anonymous function is set using the addOnStageChange method it
         *                cannot be removed using this method.
         */
        static removeOnStageSelected(handler) {
            return Form.formContext.data.process.removeOnStageSelected(handler);
        }
        /**
         * Use this method to asynchronously retrieve the enabled business process flows that the user can switch to for an entity.
         * @returns returns callback response as Promise
         */
        static getEnabledProcesses() {
            return asPromise(Form.formContext.data.process.getEnabledProcesses, Form.formContext.data.process);
        }
        /**
         * Returns all process instances for the entity record that the calling user has access to.
         * @returns returns callback response as Promise
         */
        static getProcessInstances() {
            return asPromise(Form.formContext.data.process.getProcessInstances, Form.formContext.data.process);
        }
        /**
         * Progresses to the next stage.
         * @returns returns callback response as Promise
         */
        static moveNext() {
            return asPromise(Form.formContext.data.process.moveNext, Form.formContext.data.process);
        }
        /**
         * Moves to the previous stage.
         * @returns returns callback response as Promise
         */
        static movePrevious() {
            return asPromise(Form.formContext.data.process.movePrevious, Form.formContext.data.process);
        }
        /**
         * Set a Process as the active process.
         * @param processId The Id of the process to make the active process.
         * @returns returns callback response as Promise
         */
        static setActiveProcess(processId) {
            return asPromise(Form.formContext.data.process.setActiveProcess, Form.formContext.data.process, processId);
        }
        /**
         * Sets a process instance as the active instance
         * @param processInstanceId The Id of the process instance to make the active instance.
         * @returns returns callback response as Promise
         */
        static setActiveProcessInstance(processInstanceId) {
            return asPromise(Form.formContext.data.process.setActiveProcessInstance, Form.formContext.data.process, processInstanceId);
        }
        /**
         * Set a stage as the active stage.
         * @param stageId the Id of the stage to make the active stage.
         * @returns returns callback response as Promise
         */
        static setActiveStage(stageId) {
            return asPromise(Form.formContext.data.process.setActiveStage, Form.formContext.data.process, stageId);
        }
        /**
         * Use this method to set the current status of the process instance
         * @param status The new status for the process
         * @returns returns callback response as Promise
         */
        static setStatus(status) {
            return asPromise(Form.formContext.data.process.setStatus, Form.formContext.data.process, status);
        }
    }
    XrmEx.Process = Process;
    class Fields {
        /**
         * Adds a handler or an array of handlers to be called when the attribute's value is changed.
         * @param fields An array of fields to on which this method should be applied.
         * @param handlers The function reference or an array of function references.
         */
        static addOnChange(fields, handler) {
            fields.forEach((field) => {
                field.addOnChange(handler);
            });
        }
        /**
         * Fire all "on change" event handlers.
         * @param fields An array of fields to on which this method should be applied.
         */
        static fireOnChange(fields) {
            fields.forEach((field) => {
                field.fireOnChange();
            });
        }
        /**
         * Removes the handler from the "on change" event.
         * @param fields An array of fields to on which this method should be applied.
         * @param handler The handler.
         */
        static removeOnChange(fields, handler) {
            fields.forEach((field) => {
                field.removeOnChange(handler);
            });
        }
        /**
         * Sets the required level.
         * @param fields An array of fields to on which this method should be applied.
         * @param requirementLevel The requirement level, as either "none", "required", or "recommended"
         */
        static setRequiredLevel(fields, requirementLevel) {
            fields.forEach((field) => {
                field.setRequiredLevel(requirementLevel);
            });
        }
        /**
         * Sets the submit mode.
         * @param fields An array of fields to on which this method should be applied.
         * @param submitMode The submit mode, as either "always", "never", or "dirty".
         * @default submitMode "dirty"
         * @see {@link XrmEnum.AttributeRequirementLevel}
         */
        static setSubmitMode(fields, submitMode) {
            fields.forEach((field) => {
                field.setSubmitMode(submitMode);
            });
        }
        /**
         * Sets the value.
         * @param fields An array of fields to on which this method should be applied.
         * @param value The value.
         * @remarks Attributes on Quick Create Forms will not save values set with this method.
         */
        static setValue(fields, value) {
            fields.forEach((field) => {
                field.setValue(value);
            });
        }
        /**
         * Sets a value for a column to determine whether it is valid or invalid with a message
         * @param fields An array of fields to on which this method should be applied.
         * @param isValid Specify false to set the column value to invalid and true to set the value to valid.
         * @param message The message to display.
         * @see {@link https://learn.microsoft.com/en-us/power-apps/developer/model-driven-apps/clientapi/reference/attributes/setisvalid External Link: setIsValid (Client API reference)}
         */
        static setIsValid(fields, isValid, message) {
            fields.forEach((field) => {
                field.setIsValid(isValid, message);
            });
        }
        /**
         * Sets the required level.
         * @param fields An array of fields to on which this method should be applied.
         * @param required The requirement level, as either false for "none" or true for "required"
         */
        static setRequired(fields, required) {
            fields.forEach((field) => {
                field.setRequired(required);
            });
        }
        /**
         * Sets the state of the control to either enabled, or disabled.
         * @param fields An array of fields to on which this method should be applied.
         * @param disabled true to disable, false to enable.
         */
        static setDisabled(fields, disabled) {
            fields.forEach((field) => {
                field.setDisabled(disabled);
            });
        }
        /**
         * Sets the visibility state.
         * @param fields An array of fields to on which this method should be applied.
         * @param visible true to show, false to hide.
         */
        static setVisible(fields, visible) {
            fields.forEach((field) => {
                field.setVisible(visible);
            });
        }
        /**
         * Sets a control-local notification message.
         * @param fields An array of fields to on which this method should be applied.
         * @param message The message.
         * @param uniqueId Unique identifier.
         * @returns true if it succeeds, false if it fails.
         * @remarks     When this method is used on Microsoft Dynamics CRM for tablets a red "X" icon
         *              appears next to the control. Tapping on the icon will display the message.
         */
        static setNotification(fields, message, uniqueId) {
            fields.forEach((field) => {
                field.setNotification(message, uniqueId);
            });
        }
        /**
         * Displays an error or recommendation notification for a control, and lets you specify actions to execute based on the notification.
         * @param fields An array of fields to on which this method should be applied.
         */
        static addNotification(fields, message, notificationLevel, uniqueId, actions) {
            fields.forEach((field) => {
                field.addNotification(message, notificationLevel, uniqueId, actions);
            });
        }
        /**
         * Clears the notification identified by uniqueId.
         * @param fields An array of fields to on which this method should be applied.
         * @param uniqueId (Optional) Unique identifier.
         * @returns true if it succeeds, false if it fails.
         * @remarks If the uniqueId parameter is not used, the current notification shown will be removed.
         */
        static removeNotification(fields, uniqueId) {
            fields.forEach((field) => {
                field.removeNotification(uniqueId);
            });
        }
    }
    XrmEx.Fields = Fields;
    /**
     * Represents a form in Dynamics 365.
     */
    class Form {
        static _formContext;
        static _executionContext;
        constructor() { }
        /**Gets a reference to the current form context*/
        static get formContext() {
            return this._formContext;
        }
        /**Gets a reference to the current executio context*/
        static get executionContext() {
            return this._executionContext;
        }
        /**Gets a lookup value that references the record.*/
        static get entityReference() {
            return Form.formContext.data.entity.getEntityReference();
        }
        /**Sets a reference to the current form context*/
        static set formContext(context) {
            if (!context)
                throw new Error(`XrmEx.Form.setFormContext: The executionContext or formContext was not passed to the function.`);
            if ("getFormContext" in context) {
                this._executionContext = context;
                this._formContext = context.getFormContext();
            }
            else if ("data" in context)
                this._formContext = context;
            else
                throw new Error(`XrmEx.Form.setFormContext: The passed context is not an executionContext or formContext.`);
        }
        /**Sets a reference to the current execution context*/
        static set executionContext(context) {
            if (!context)
                throw new Error(`XrmEx.Form.setExecutionContext: The executionContext or formContext was not passed to the function.`);
            if ("getFormContext" in context) {
                this._executionContext = context;
                this._formContext = context.getFormContext();
            }
            else if ("data" in context)
                this._formContext = context;
            else
                throw new Error(`XrmEx.Form.setExecutionContext: The passed context is not an executionContext or formContext.`);
        }
        /**Returns true if form is from type create*/
        static get IsCreate() {
            return Form.formContext.ui.getFormType() == 1;
        }
        /**Returns true if form is from type update*/
        static get IsUpdate() {
            return Form.formContext.ui.getFormType() == 2;
        }
        /**Returns true if form is not from type create*/
        static get IsNotCreate() {
            return Form.formContext.ui.getFormType() != 1;
        }
        /**Returns true if form is not from type update*/
        static get IsNotUpdate() {
            return Form.formContext.ui.getFormType() != 2;
        }
        /**
         * Displays a form level notification. Any number of notifications can be displayed and will remain until removed using clearFormNotification.
         * The height of the notification area is limited so each new message will be added to the top.
         * @param message The text of the notification message.
         * @param level The level of the notification which defines how the message will be displayed, such as the icon.
         * ERROR: Notification will use the system error icon.
         * WARNING: Notification will use the system warning icon.
         * INFO: Notification will use the system info icon.
         * @param uniqueId Unique identifier for the notification which is used with clearFormNotification to remove the notification.
         * @returns true if it succeeds, othenprwise false.
         */
        static addFormNotification(message, level, uniqueId) {
            try {
                return Form.formContext.ui.setFormNotification(message, level, uniqueId);
            }
            catch (error) {
                throw new Error(`XrmEx.${XrmEx.getFunctionName()}:\n${error.message}`);
            }
        }
        /**
         * Clears the form notification described by uniqueId.
         * @param uniqueId Unique identifier.
         * @returns True if it succeeds, otherwise false.
         */
        static removeFormNotification(uniqueId) {
            try {
                return Form.formContext.ui.clearFormNotification(uniqueId);
            }
            catch (error) {
                throw new Error(`XrmEx.${XrmEx.getFunctionName()}:\n${error.message}`);
            }
        }
        /**
         * Adds a handler to be called when the record is saved.
         */
        static addOnSave(handlers) {
            try {
                if (!Array.isArray(handlers)) {
                    handlers = [handlers];
                }
                handlers.forEach((handler) => {
                    if (typeof handler !== "function") {
                        throw new Error(`'${handler}' is not a function`);
                    }
                    Form.formContext.data.entity.removeOnSave(handler);
                    Form.formContext.data.entity.addOnSave(handler);
                });
            }
            catch (error) {
                throw new Error(`XrmEx.${XrmEx.getFunctionName()}:\n${error.message}`);
            }
        }
        /**
         * Adds a function to be called after the OnSave is complete.
         * @param handler The handler.
         * @remarks Added in 9.2
         * @see {@link https://docs.microsoft.com/en-us/powerapps/developer/model-driven-apps/clientapi/reference/events/postsave External Link: PostSave Event Documentation}
         */
        static addOnPostSave(handlers) {
            try {
                if (!Array.isArray(handlers)) {
                    handlers = [handlers];
                }
                handlers.forEach((handler) => {
                    if (typeof handler !== "function") {
                        throw new Error(`'${handler}' is not a function`);
                    }
                    Form.formContext.data.entity.removeOnPostSave(handler);
                    Form.formContext.data.entity.addOnPostSave(handler);
                });
            }
            catch (error) {
                throw new Error(`XrmEx.${XrmEx.getFunctionName()}:\n${error.message}`);
            }
        }
        /**
         * Adds a function to be called when form data is loaded.
         * @param handler The function to be executed when the form data loads. The function will be added to the bottom of the event handler pipeline.
         */
        static addOnLoad(handlers) {
            try {
                if (!Array.isArray(handlers)) {
                    handlers = [handlers];
                }
                handlers.forEach((handler) => {
                    if (typeof handler !== "function") {
                        throw new Error(`'${handler}' is not a function`);
                    }
                    Form.formContext.data.removeOnLoad(handler);
                    Form.formContext.data.addOnLoad(handler);
                });
            }
            catch (error) {
                throw new Error(`XrmEx.${XrmEx.getFunctionName()}:\n${error.message}`);
            }
        }
        /**
         * Adds a handler to be called when the attribute's value is changed.
         * @param handler The function reference.
         */
        static addOnChange(fields, handlers, execute) {
            try {
                if (!Array.isArray(handlers)) {
                    handlers = [handlers];
                }
                handlers.forEach((handler) => {
                    if (typeof handler !== "function") {
                        throw new Error(`'${handler}' is not a function`);
                    }
                    fields.forEach((field) => {
                        field.removeOnChange(handler);
                        field.addOnChange(handler);
                    });
                });
                if (execute) {
                    fields.forEach((field) => {
                        field.Attribute.fireOnChange();
                    });
                }
            }
            catch (error) {
                throw new Error(`XrmEx.${XrmEx.getFunctionName()}:\n${error.message}`);
            }
        }
    }
    XrmEx.Form = Form;
    let Class;
    (function (Class) {
        /**
         * Used to execute methods related to a single Attribute
         */
        class Field {
            static allFields = [];
            Name;
            _attribute;
            constructor(attributeName) {
                const existingField = Field.allFields.find((f) => f.Name === attributeName);
                if (existingField) {
                    return existingField;
                }
                this.Name = attributeName;
                Field.allFields.push(this);
            }
            setValue(value) {
                return this.Attribute.setValue(value);
            }
            getAttributeType() {
                return this.Attribute.getAttributeType();
            }
            getFormat() {
                return this.Attribute.getFormat();
            }
            getIsDirty() {
                return this.Attribute.getIsDirty();
            }
            getName() {
                return this.Attribute.getName();
            }
            getParent() {
                return this.Attribute.getParent();
            }
            getRequiredLevel() {
                return this.Attribute.getRequiredLevel();
            }
            getSubmitMode() {
                return this.Attribute.getSubmitMode();
            }
            getUserPrivilege() {
                return this.Attribute.getUserPrivilege();
            }
            removeOnChange(handler) {
                return this.Attribute.removeOnChange(handler);
            }
            setSubmitMode(submitMode) {
                return this.Attribute.setSubmitMode(submitMode);
            }
            getValue() {
                return this.Attribute.getValue();
            }
            setIsValid(isValid, message) {
                return this.Attribute.setIsValid(isValid, message);
            }
            get Attribute() {
                return (this._attribute ??=
                    Form.formContext.getAttribute(this.Name) ??
                        XrmEx.throwError(`The attribute '${this.Name}' was not found on the form.`));
            }
            get controls() {
                return this.Attribute.controls;
            }
            /**
             * Gets the value.
             * @returns The value.
             */
            get Value() {
                return this.Attribute.getValue();
            }
            set Value(value) {
                this.Attribute.setValue(value);
            }
            /**
             * Sets a control-local notification message.
             * @param message The message.
             * @param uniqueId Unique identifier.
             * @returns true if it succeeds, false if it fails.
             * @remarks     When this method is used on Microsoft Dynamics CRM for tablets a red "X" icon
             *              appears next to the control. Tapping on the icon will display the message.
             */
            setNotification(message, uniqueId) {
                try {
                    if (!message)
                        throw new Error(`no message was provided.`);
                    if (!uniqueId)
                        throw new Error(`no uniqueId was provided.`);
                    this.controls.forEach((control) => control.setNotification(message, uniqueId));
                    return this;
                }
                catch (error) {
                    throw new Error(`XrmEx.${XrmEx.getFunctionName()}:\n${error.message}`);
                }
            }
            /**
             * Sets the visibility state.
             * @param visible true to show, false to hide.
             */
            setVisible(visible) {
                try {
                    this.controls.forEach((control) => control.setVisible(visible));
                    return this;
                }
                catch (error) {
                    throw new Error(`XrmEx.${XrmEx.getFunctionName()}:\n${error.message}`);
                }
            }
            /**
             * Sets the state of the control to either enabled, or disabled.
             * @param disabled true to disable, false to enable.
             */
            setDisabled(disabled) {
                try {
                    this.controls.forEach((control) => control.setDisabled(disabled));
                    return this;
                }
                catch (error) {
                    throw new Error(`XrmEx.${XrmEx.getFunctionName()}:\n${error.message}`);
                }
            }
            /**
             * Sets the required level.
             * @param requirementLevel The requirement level, as either "none", "required", or "recommended"
             */
            setRequiredLevel(requirementLevel) {
                try {
                    this.Attribute.setRequiredLevel(requirementLevel);
                    return this;
                }
                catch (error) {
                    throw new Error(`XrmEx.${XrmEx.getFunctionName()}:\n${error.message}`);
                }
            }
            /**
             * Sets the required level.
             * @param required The requirement level, as either false for "none" or true for "required"
             */
            setRequired(required) {
                try {
                    this.Attribute.setRequiredLevel(required ? "required" : "none");
                    return this;
                }
                catch (error) {
                    throw new Error(`XrmEx.${XrmEx.getFunctionName()}:\n${error.message}`);
                }
            }
            /**Fire all "on change" event handlers. */
            fireOnChange() {
                try {
                    this.Attribute.fireOnChange();
                    return this;
                }
                catch (error) {
                    throw new Error(`XrmEx.${XrmEx.getFunctionName()}:\n${error.message}`);
                }
            }
            /**
             * Adds a handler or an array of handlers to be called when the attribute's value is changed.
             * @param handlers The function reference or an array of function references.
             */
            addOnChange(handlers) {
                try {
                    if (Array.isArray(handlers)) {
                        for (const handler of handlers) {
                            if (typeof handler !== "function")
                                throw new Error(`'${handler}' is not a function`);
                            this.Attribute.removeOnChange(handler);
                            this.Attribute.addOnChange(handler);
                        }
                    }
                    else {
                        if (typeof handlers !== "function")
                            throw new Error(`'${handlers}' is not a function`);
                        this.Attribute.removeOnChange(handlers);
                        this.Attribute.addOnChange(handlers);
                    }
                    return this;
                }
                catch (error) {
                    throw new Error(`XrmEx.${XrmEx.getFunctionName()}:\n${error.message}`);
                }
            }
            /**
             * Displays an error or recommendation notification for a control, and lets you specify actions to execute based on the notification.
             */
            addNotification(message, notificationLevel, uniqueId, actions) {
                try {
                    if (!uniqueId)
                        throw new Error(`no uniqueId was provided.`);
                    if (actions && !Array.isArray(actions))
                        throw new Error(`the action parameter is not an array of ControlNotificationAction`);
                    this.controls.forEach((control) => {
                        control.addNotification({
                            messages: [message],
                            notificationLevel: notificationLevel,
                            uniqueId: uniqueId,
                            actions: actions,
                        });
                    });
                    return this;
                }
                catch (error) {
                    throw new Error(`XrmEx.${XrmEx.getFunctionName()}:\n${error.message}`);
                }
            }
            /**
             * Clears the notification identified by uniqueId.
             * @param uniqueId (Optional) Unique identifier.
             * @returns true if it succeeds, false if it fails.
             * @remarks If the uniqueId parameter is not used, the current notification shown will be removed.
             */
            removeNotification(uniqueId) {
                try {
                    this.controls.forEach((control) => {
                        control.clearNotification(uniqueId);
                    });
                    return this;
                }
                catch (error) {
                    throw new Error(`XrmEx.${XrmEx.getFunctionName()}:\n${error.message}`);
                }
            }
        }
        Class.Field = Field;
        class TextField extends Field {
            constructor(attribute) {
                super(attribute);
            }
            getMaxLength() {
                return this.Attribute.getMaxLength();
            }
            getFormat() {
                return this.Attribute.getFormat();
            }
            get Attribute() {
                return (this._attribute ??=
                    Form.formContext.getAttribute(this.Name) ??
                        XrmEx.throwError(`Field '${this.Name}' does not exist`));
            }
            get controls() {
                return this.Attribute.controls;
            }
            get Value() {
                return this.Attribute.getValue() ?? null;
            }
            set Value(value) {
                this.Attribute.setValue(value);
            }
        }
        Class.TextField = TextField;
        class NumberField extends Field {
            constructor(attribute) {
                super(attribute);
            }
            getFormat() {
                return this.Attribute.getFormat();
            }
            getMax() {
                return this.Attribute.getMax();
            }
            getMin() {
                return this.Attribute.getMin();
            }
            getPrecision() {
                return this.Attribute.getPrecision();
            }
            setPrecision(precision) {
                return this.Attribute.setPrecision(precision);
            }
            get Attribute() {
                return (this._attribute ??=
                    Form.formContext.getAttribute(this.Name) ??
                        XrmEx.throwError(`Field '${this.Name}' does not exist`));
            }
            get controls() {
                return this.Attribute.controls;
            }
            get Value() {
                return this.Attribute.getValue() ?? null;
            }
            set Value(value) {
                this.Attribute.setValue(value);
            }
        }
        Class.NumberField = NumberField;
        class DateField extends Field {
            constructor(attribute) {
                super(attribute);
            }
            getFormat() {
                return this.Attribute.getFormat();
            }
            get Attribute() {
                return (this._attribute ??=
                    Form.formContext.getAttribute(this.Name) ??
                        XrmEx.throwError(`Field '${this.Name}' does not exist`));
            }
            get controls() {
                return this.Attribute.controls;
            }
            get Value() {
                return this.Attribute.getValue() ?? null;
            }
            set Value(value) {
                this.Attribute.setValue(value);
            }
        }
        Class.DateField = DateField;
        class BooleanField extends Field {
            constructor(attribute) {
                super(attribute);
            }
            getAttributeType() {
                return this.Attribute.getAttributeType();
            }
            getInitialValue() {
                return this.Attribute.getInitialValue();
            }
            get Attribute() {
                return (this._attribute ??=
                    Form.formContext.getAttribute(this.Name) ??
                        XrmEx.throwError(`Field '${this.Name}' does not exist`));
            }
            get controls() {
                return this.Attribute.controls;
            }
            get Value() {
                return this.Attribute.getValue() ?? null;
            }
            set Value(value) {
                this.Attribute.setValue(value);
            }
        }
        Class.BooleanField = BooleanField;
        class MultiSelectOptionSetField extends Field {
            Option;
            constructor(attributeName, option) {
                super(attributeName);
                this.Option = option;
            }
            getFormat() {
                return this.Attribute.getFormat();
            }
            getOption(value) {
                if (typeof value === "number") {
                    return this.Attribute.getOption(value);
                }
                else {
                    return this.Attribute.getOption(value);
                }
            }
            getOptions() {
                return this.Attribute.getOptions();
            }
            getSelectedOption() {
                return this.Attribute.getSelectedOption();
            }
            getText() {
                return this.Attribute.getText();
            }
            getInitialValue() {
                return this.Attribute.getInitialValue();
            }
            get Attribute() {
                return (this._attribute ??=
                    Form.formContext.getAttribute(this.Name) ??
                        XrmEx.throwError(`Field '${this.Name}' does not exist`));
            }
            get controls() {
                return this.Attribute.controls;
            }
            get Value() {
                return this.Attribute.getValue();
            }
            set Value(value) {
                if (Array.isArray(value)) {
                    let values = [];
                    value.forEach((v) => {
                        if (typeof v == "number")
                            values.push(v);
                        else
                            values.push(this.Option[v]);
                    });
                    this.Attribute.setValue(values);
                }
                else
                    XrmEx.throwError(`Field Value '${value}' is not an Array`);
            }
        }
        Class.MultiSelectOptionSetField = MultiSelectOptionSetField;
        class LookupField extends Field {
            _customFilters = [];
            _isEntityAvailableOffline = undefined;
            constructor(attribute) {
                super(attribute);
            }
            getIsPartyList() {
                return this.Attribute.getIsPartyList();
            }
            get Attribute() {
                return (this._attribute ??=
                    Form.formContext.getAttribute(this.Name) ??
                        XrmEx.throwError(`Field '${this.Name}' does not exist`));
            }
            get controls() {
                return this.Attribute.controls;
            }
            /**Gets the id of the first lookup value*/
            get Id() {
                return this.Value && this.Value.length > 0
                    ? XrmEx.normalizeGuid(this.Value[0].id)
                    : null;
            }
            /**Gets the entityType of the first lookup value*/
            get EntityType() {
                return this.Value && this.Value.length > 0
                    ? this.Value[0].entityType
                    : null;
            }
            /**Gets the formatted value of the first lookup value*/
            get FormattedValue() {
                return this.Value && this.Value.length > 0 ? this.Value[0].name : null;
            }
            get Value() {
                return this.Attribute.getValue() ?? null;
            }
            set Value(value) {
                this.Attribute.setValue(value);
            }
            /**
             * Sets the value of a lookup
             * @param id Guid of the record
             * @param entityType logicalname of the entity
             * @param name formatted value
             * @param append if true, adds value to the array instead of replacing it
             */
            setLookupValue(id, entityType, name, append = false) {
                try {
                    if (!id)
                        throw new Error(`no id parameter was provided.`);
                    if (!entityType)
                        throw new Error(`no entityType parameter was provided.`);
                    id = XrmEx.normalizeGuid(id);
                    const lookupValue = {
                        id,
                        entityType,
                        name,
                    };
                    this.Value =
                        append && this.Value
                            ? this.Value.concat(lookupValue)
                            : [lookupValue];
                    return this;
                }
                catch (error) {
                    throw new Error(`XrmEx.${XrmEx.getFunctionName()}:\n${error.message}`);
                }
            }
            /**
             * Sets a lookup with a lookup from the retrieved record.
             * @param selectName
             * @param retrievedRecord
             * @example
             * var contact = await fields.Contact.retrieve('?$select=_parentcustomerid_value');
             * fields.Account.setLookupFromRetrieve('_parentcustomerid_value', contact);
             * //Alternate
             * fields.Account.setLookupFromRetrieve('parentcustomerid', contact);
             */
            setLookupFromRetrieve(selectName, retrievedRecord) {
                if (!selectName.endsWith("_value"))
                    selectName = `_${selectName}_value`;
                if (!retrievedRecord || !retrievedRecord[`${selectName}`]) {
                    this.Value = null;
                    return;
                }
                this.Value = [
                    {
                        id: retrievedRecord[`${selectName}`],
                        entityType: retrievedRecord[`${selectName}@Microsoft.Dynamics.CRM.lookuplogicalname`],
                        name: retrievedRecord[`${selectName}@OData.Community.Display.V1.FormattedValue`],
                    },
                ];
            }
            tsIgFunct() {
                // @ts-ignore
                return Xrm.WebApi.offline.isAvailableOffline(this.EntityType);
            }
            // test
            /**
             * Returns native SDK WebApi appropriate for the current client state
             * @returns Xrm.WebApiOffline or Xrm.WebApiOnline
             */
            // getXrmWebApi(): Xrm.WebApiOffline | Xrm.WebApiOnline {
            getXrmWebApi() {
                if (isOffline() === true) {
                    return Xrm.WebApi.offline;
                }
                else {
                    return Xrm.WebApi.online;
                }
            }
            // Work in progress below!
            // getXrmWebApi(): Xrm.WebApiOffline | Xrm.WebApiOnline {
            //   if (isOffline() === true) {
            //     if (this._isEntityAvailableOffline === undefined) {
            //       this._isEntityAvailableOffline = this.tsIgFunct();
            //       if (this._isEntityAvailableOffline === undefined) {
            //         XrmEx.throwError(
            //           "Unable to determine offline availability for entity: " +
            //             this.EntityType
            //         );
            //       }
            //       // Recursive call to self, value should now be either true or false
            //       this.getXrmWebApi();
            //     } else if (this._isEntityAvailableOffline === true) {
            //       return Xrm.WebApi.offline;
            //     } else {
            //       throwError("This entity is not available in offline mode");
            //     }
            //   } else {
            //     return Xrm.WebApi.online;
            //   }
            // }
            /**
             * Retrieves an entity record.
             * @param options (Optional) OData system query options, $select and $expand, to retrieve your data.
             * - Use the $select system query option to limit the properties returned by including a comma-separated
             *   list of property names. This is an important performance best practice. If properties aren’t
             *   specified using $select, all properties will be returned.
             * - Use the $expand system query option to control what data from related entities is returned. If you
             *   just include the name of the navigation property, you’ll receive all the properties for related
             *   records. You can limit the properties returned for related records using the $select system query
             *   option in parentheses after the navigation property name. Use this for both single-valued and
             *   collection-valued navigation properties.
             * - You can also specify multiple query options by using & to separate the query options.
             * @example <caption>options example:</caption>
             * options: $select=name&$expand=primarycontactid($select=contactid,fullname)
             * @returns On success, returns a promise containing a JSON object with the retrieved attributes and their values.
             * @see {@link https://docs.microsoft.com/en-us/dynamics365/customer-engagement/developer/clientapi/reference/xrm-webapi/retrieverecord External Link: retrieveRecord (Client API reference)}
             */
            async retrieve(options) {
                try {
                    if (!this.Id || !this.EntityType)
                        return null;
                    const record = await Xrm.WebApi.retrieveRecord(this.EntityType, this.Id, options);
                    return record;
                }
                catch (error) {
                    throw new Error(`XrmEx.${XrmEx.getFunctionName()}:\n${error.message}`);
                }
            }
            /**
             * Updates an entity record.
             * @param data (required) A JSON object containing key : value pairs where key is the attribute of the table
             * and value is the value of the attribute you wish to update.
             * @example <caption>data example:</caption>
             * var data =
             *   {
             *     "name": "Updated Sample Account ",
             *     "creditonhold": true,
             *     "address1_latitude": 47.639583,
             *     "description": "This is the updated description of the sample account",
             *     "revenue": 6000000,
             *     "accountcategorycode": 2
             *   };
             * @returns On success, returns a promise object with entityType (string, table name) and id (string, GUID of the record)
             * @see {@link https://learn.microsoft.com/en-us/power-apps/developer/model-driven-apps/clientapi/reference/xrm-webapi/updaterecord}
             */
            async update(data) {
                try {
                    if (!this.Id || !this.EntityType || !data) {
                        throwError("Missing required arguments for update method");
                    }
                    const result = await this.getXrmWebApi().updateRecord(this.EntityType, this.Id, data);
                    return result;
                }
                catch (error) {
                    throw new Error(`XrmEx.${XrmEx.getFunctionName()}:\n${error.message}`);
                }
            }
            /**
             * Adds an additional custom filter to the lookup, with the "AND" filter operator.
             * @param filter Specifies the filter, as a serialized FetchXML "filter" node.
             * @param entityLogicalName (Optional) The logical name of the entity.
             * @remarks     If entityLogicalName is not specified, the filter will be applied to all entities
             *              valid for the Lookup control.
             * @example     Example filter: <filter type="and">
             *                              <condition attribute="address1_city" operator="eq" value="Redmond" />
             *                              </filter>
             */
            addPreFilterToLookup(filterXml, entityLogicalName) {
                try {
                    _addCustomFilter.controls = this.controls;
                    this.controls.forEach((control) => {
                        control.addPreSearch(_addCustomFilter);
                    });
                    this._customFilters.push(_addCustomFilter);
                    return this;
                }
                catch (error) {
                    throw new Error(`XrmEx.${XrmEx.getFunctionName()}:\n${error.message}`);
                }
                function _addCustomFilter() {
                    _addCustomFilter.controls.forEach((control) => {
                        control.addCustomFilter(filterXml, entityLogicalName);
                    });
                }
            }
            /**
             * Adds an additional custom filter to the lookup, with the "AND" filter operator.
             * @param entityLogicalName (Optional) The logical name of the entity.
             * @param primaryAttributeIdName (Optional) The logical name of the primary key.
             * @param fetchXml Specifies the FetchXML used to filter.
             * @remarks     If entityLogicalName is not specified, the filter will be applied to all entities
             *              valid for the Lookup control.
             * @example     Example fetchXml: <fetch>
             *                              <entity name="contact">
             *                                  <filter>
             *                                  <condition attribute="address1_city" operator="eq" value="Redmond" />
             *                                  </filter>
             *                              </entity>
             *                              </fetch>
             */
            async addPreFilterToLookupAdvanced(entityLogicalName, primaryAttributeIdName, fetchXml) {
                try {
                    const result = await Xrm.WebApi.online.retrieveMultipleRecords(entityLogicalName, "?fetchXml=" + fetchXml);
                    const data = result.entities;
                    let filteredEntities = "";
                    _addCustomFilter.controls = this.controls;
                    data.forEach((item) => {
                        filteredEntities += `<value>${item[primaryAttributeIdName]}</value>`;
                    });
                    fetchXml = filteredEntities
                        ? `<filter><condition attribute='${primaryAttributeIdName}' operator='in'>${filteredEntities}</condition></filter>`
                        : `<filter><condition attribute='${primaryAttributeIdName}' operator='null'/></filter>`;
                    this.controls.forEach((control) => {
                        control.addPreSearch(_addCustomFilter);
                    });
                    this._customFilters.push(_addCustomFilter);
                }
                catch (error) {
                    throw new Error(`XrmEx.${XrmEx.getFunctionName()}:\n${error.message}`);
                }
                function _addCustomFilter() {
                    _addCustomFilter.controls.forEach((control) => {
                        control.addCustomFilter(fetchXml, entityLogicalName);
                    });
                }
            }
            /**
             * Removes all filters set on the current lookup attribute by using addPreFilterToLookup or addPreFilterToLookupAdvanced
             */
            clearPreFilterFromLookup() {
                try {
                    this._customFilters.forEach((customFilter) => {
                        this.controls.forEach((control) => {
                            control.removePreSearch(customFilter);
                        });
                    });
                    return this;
                }
                catch (error) {
                    throw new Error(`XrmEx.${XrmEx.getFunctionName()}:\n${error.message}`);
                }
            }
        }
        Class.LookupField = LookupField;
        class OptionsetField extends Field {
            _control;
            Option;
            constructor(attributeName, option) {
                super(attributeName);
                this.Option = option;
            }
            getFormat() {
                return this.Attribute.getFormat();
            }
            getOption(value) {
                if (typeof value === "number") {
                    return this.Attribute.getOption(value);
                }
                else {
                    return this.Attribute.getOption(value);
                }
            }
            getOptions() {
                return this.Attribute.getOptions();
            }
            getSelectedOption() {
                return this.Attribute.getSelectedOption();
            }
            getText() {
                return this.Attribute.getText();
            }
            getInitialValue() {
                return this.Attribute.getInitialValue();
            }
            get Attribute() {
                return (this._attribute ??=
                    Form.formContext.getAttribute(this.Name) ??
                        XrmEx.throwError(`Field '${this.Name}' does not exist`));
            }
            get controls() {
                return this.Attribute.controls;
            }
            get control() {
                return (this._control ??=
                    Form.formContext.getControl(this.Name) ??
                        XrmEx.throwError(`Control '${this.Name}' does not exist`));
            }
            get Value() {
                return this.Attribute.getValue();
            }
            set Value(value) {
                if (typeof value == "number")
                    this.Attribute.setValue(value);
                else
                    this.Attribute.setValue(this.Option[value]);
            }
            /**
             * Adds an option.
             *
             * @param values an array with the option values to add
             * @param index (Optional) zero-based index of the option.
             *
             * @remarks This method does not check that the values within the options you add are valid.
             *          If index is not provided, the new option will be added to the end of the list.
             */
            addOption(values, index) {
                try {
                    if (!Array.isArray(values))
                        throw new Error(`values is not an Array:\nvalues: '${values}'`);
                    const optionSetValues = this.control.getAttribute().getOptions() ?? [];
                    for (const element of optionSetValues) {
                        if (values.includes(element.value)) {
                            this.control.addOption(element, index);
                        }
                    }
                    return this;
                }
                catch (error) {
                    throw new Error(`XrmEx.${XrmEx.getFunctionName()}:\n${error.message}`);
                }
            }
            /**
             * Removes the option matching the value.
             *
             * @param value The value.
             */
            removeOption(values) {
                try {
                    if (!Array.isArray(values))
                        throw new Error(`values is not an Array:\nvalues: '${values}'`);
                    const optionSetValues = this.control.getAttribute().getOptions() ?? [];
                    for (const element of optionSetValues) {
                        if (values.includes(element.value)) {
                            this.control.removeOption(element.value);
                        }
                    }
                    return this;
                }
                catch (error) {
                    throw new Error(`XrmEx.${XrmEx.getFunctionName()}:\n${error.message}`);
                }
            }
            /**
             * Clears all options.
             */
            clearOptions() {
                try {
                    this.control.clearOptions();
                    return this;
                }
                catch (error) {
                    throw new Error(`XrmEx.${XrmEx.getFunctionName()}:\n${error.message}`);
                }
            }
        }
        Class.OptionsetField = OptionsetField;
        class Section {
            Name;
            _section;
            parentTab;
            constructor(name) {
                this.Name = name;
            }
            get Section() {
                return (this._section ??=
                    this.parentTab.sections.get(this.Name) ??
                        XrmEx.throwError(`The section '${this.Name}' was not found on the form.`));
            }
            getName() {
                return this.Section.getName();
            }
            getParent() {
                return this.Section.getParent();
            }
            controls;
            setVisible(visible) {
                return this.Section.setVisible(visible);
            }
            getVisible() {
                return this.Section.getVisible();
            }
            getLabel() {
                return this.Section.getLabel();
            }
            setLabel(label) {
                return this.Section.setLabel(label);
            }
        }
        Class.Section = Section;
        class Tab {
            Name;
            _tab;
            Section;
            constructor(name, section) {
                this.Name = name;
                this.Section = section;
                for (let key in section) {
                    section[key].parentTab = this;
                }
            }
            get sections() {
                return this.Tab.sections;
            }
            get Tab() {
                return (this._tab ??=
                    Form.formContext.ui.tabs.get(this.Name) ??
                        XrmEx.throwError(`The tab '${this.Name}' was not found on the form.`));
            }
            addTabStateChange(handler) {
                return this.Tab.addTabStateChange(handler);
            }
            getDisplayState() {
                return this.Tab.getDisplayState();
            }
            getName() {
                return this.Tab.getName();
            }
            getParent() {
                return this.Tab.getParent();
            }
            removeTabStateChange(handler) {
                return this.Tab.removeTabStateChange(handler);
            }
            setDisplayState(displayState) {
                return this.Tab.setDisplayState(displayState);
            }
            setVisible(visible) {
                return this.Tab.setVisible(visible);
            }
            getVisible() {
                return this.Tab.getVisible();
            }
            getLabel() {
                return this.Tab.getLabel();
            }
            setLabel(label) {
                return this.Tab.setLabel(label);
            }
            setFocus() {
                return this.Tab.setFocus();
            }
        }
        Class.Tab = Tab;
        class GridControl {
            Name;
            _gridControl;
            constructor(name) {
                this.Name = name;
            }
            get GridControl() {
                return ((this._gridControl ??=
                    Form.formContext.getControl(this.Name)) ??
                    XrmEx.throwError(`The grid '${this.Name}' was not found on the form.`));
            }
            get Grid() {
                return this.GridControl.getGrid();
            }
            addOnLoad(handler) {
                this.GridControl.removeOnLoad(handler);
                return this.GridControl.addOnLoad(handler);
            }
            getContextType() {
                return this.GridControl.getContextType();
            }
            getEntityName() {
                return this.GridControl.getEntityName();
            }
            getFetchXml() {
                return this.GridControl.getFetchXml();
            }
            getGrid() {
                return this.GridControl.getGrid();
            }
            getRelationship() {
                return this.GridControl.getRelationship();
            }
            getUrl(client) {
                return this.GridControl.getUrl(client);
            }
            getViewSelector() {
                return this.GridControl.getViewSelector();
            }
            openRelatedGrid() {
                return this.GridControl.openRelatedGrid();
            }
            refresh() {
                return this.GridControl.refresh();
            }
            refreshRibbon() {
                return this.GridControl.refreshRibbon();
            }
            removeOnLoad(handler) {
                return this.GridControl.removeOnLoad(handler);
            }
            getControlType() {
                return this.GridControl.getControlType();
            }
            getName() {
                return this.GridControl.getName();
            }
            getParent() {
                return this.GridControl.getParent();
            }
            getLabel() {
                return this.GridControl.getLabel();
            }
            setLabel(label) {
                return this.GridControl.setLabel(label);
            }
            getVisible() {
                return this.GridControl.getVisible();
            }
            setVisible(visible) {
                return this.GridControl.setVisible(visible);
            }
        }
        Class.GridControl = GridControl;
    })(Class = XrmEx.Class || (XrmEx.Class = {}));
})(XrmEx || (XrmEx = {}));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiWHJtRXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvWHJtRXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsOERBQThEO0FBa0M5RCxJQUFVLEtBQUssQ0FzK0RkO0FBdCtERCxXQUFVLEtBQUs7SUFDYjs7OztPQUlHO0lBQ0gsU0FBZ0IsVUFBVSxDQUFDLFlBQW9CO1FBQzdDLE1BQU0sSUFBSSxLQUFLLENBQUMsWUFBWSxDQUFDLENBQUM7SUFDaEMsQ0FBQztJQUZlLGdCQUFVLGFBRXpCLENBQUE7SUFDRDs7Ozs7T0FLRztJQUNILFNBQWdCLFNBQVM7UUFDdkIsT0FBTyxHQUFHLENBQUMsT0FBTyxDQUFDLGdCQUFnQixFQUFFLENBQUMsTUFBTSxDQUFDLFNBQVMsRUFBRSxDQUFDO0lBQzNELENBQUM7SUFGZSxlQUFTLFlBRXhCLENBQUE7SUFDRDs7O09BR0c7SUFDSCxTQUFnQixlQUFlO1FBQzdCLElBQUk7WUFDRixNQUFNLEtBQUssR0FBRyxJQUFJLEtBQUssRUFBRSxDQUFDO1lBQzFCLE1BQU0sVUFBVSxHQUFHLEtBQUssQ0FBQyxLQUFLLEVBQUUsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDLENBQUM7WUFDdkUsTUFBTSxtQkFBbUIsR0FDdkIsVUFBVSxJQUFJLFVBQVUsQ0FBQyxNQUFNLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQztZQUNuRSxNQUFNLGlCQUFpQixHQUNyQixtQkFBbUIsRUFBRSxLQUFLLENBQUMsb0JBQW9CLENBQUM7Z0JBQ2hELG1CQUFtQixFQUFFLEtBQUssQ0FBQyxlQUFlLENBQUMsQ0FBQztZQUM5QyxNQUFNLFlBQVksR0FBRyxpQkFBaUIsQ0FBQyxDQUFDLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxDQUFD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Q0FBQTtJQUNILENBQUMsRUFuaENnQixLQUFLLEdBQUwsV0FBSyxLQUFMLFdBQUssUUFtaENyQjtBQUNILENBQUMsRUF0K0RTLEtBQUssS0FBTCxLQUFLLFFBcytEZCIsInNvdXJjZXNDb250ZW50IjpbIi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuLi9ub2RlX21vZHVsZXMvQHR5cGVzL3hybS9pbmRleC5kLnRzXCIgLz5cclxuLyoqXHJcbiAqIFJlcHJlc2VudHMgYSBwYXJhbWV0ZXIgZm9yIGEgcmVxdWVzdC5cclxuICogQHR5cGUge09iamVjdH0gUmVxdWVzdFBhcmFtZXRlclxyXG4gKiBAcHJvcGVydHkge3N0cmluZ30gTmFtZSAtIFRoZSBuYW1lIG9mIHRoZSBwYXJhbWV0ZXIuXHJcbiAqIEBwcm9wZXJ0eSB7J0Jvb2xlYW4nIHwgJ0RhdGVUaW1lJyB8ICdEZWNpbWFsJyB8ICdFbnRpdHknIHwgJ0VudGl0eUNvbGxlY3Rpb24nIHwgJ0VudGl0eVJlZmVyZW5jZScgfCAnRmxvYXQnIHwgJ0ludGVnZXInIHwgJ01vbmV5JyB8ICdQaWNrbGlzdCcgfCAnU3RyaW5nJ30gVHlwZSAtIFRoZSB0eXBlIG9mIHRoZSBwYXJhbWV0ZXIuXHJcbiAqIEBwcm9wZXJ0eSB7Kn0gVmFsdWUgLSBUaGUgdmFsdWUgb2YgdGhlIHBhcmFtZXRlci5cclxuICovXHJcbnR5cGUgUmVxdWVzdFBhcmFtZXRlciA9IHtcclxuICBOYW1lOiBzdHJpbmc7XHJcbiAgVHlwZTpcclxuICAgIHwgXCJCb29sZWFuXCJcclxuICAgIHwgXCJEYXRlVGltZVwiXHJcbiAgICB8IFwiRGVjaW1hbFwiXHJcbiAgICB8IFwiRW50aXR5XCJcclxuICAgIHwgXCJFbnRpdHlDb2xsZWN0aW9uXCJcclxuICAgIHwgXCJFbnRpdHlSZWZlcmVuY2VcIlxyXG4gICAgfCBcIkZsb2F0XCJcclxuICAgIHwgXCJJbnRlZ2VyXCJcclxuICAgIHwgXCJNb25leVwiXHJcbiAgICB8IFwiUGlja2xpc3RcIlxyXG4gICAgfCBcIlN0cmluZ1wiO1xyXG4gIFZhbHVlOiBhbnk7XHJcbn07XHJcbi8qKlxyXG4gKiBSZXByZXNlbnRzIGEgcmVmZXJlbmNlIHRvIGFuIGVudGl0eS5cclxuICogQHR5cGVcclxuICogQHByb3BlcnR5IHtzdHJpbmd9IGlkIC0gVGhlIElEIG9mIHRoZSBlbnRpdHkuXHJcbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBlbnRpdHlUeXBlIC0gVGhlIHR5cGUgb2YgdGhlIGVudGl0eS5cclxuICovXHJcbnR5cGUgRW50aXR5UmVmZXJlbmNlID0ge1xyXG4gIGlkOiBzdHJpbmc7XHJcbiAgZW50aXR5VHlwZTogc3RyaW5nO1xyXG59O1xyXG5uYW1lc3BhY2UgWHJtRXgge1xyXG4gIC8qKlxyXG4gICAqIFRocm93cyBhbiBlcnJvciB3aXRoIHRoZSBnaXZlbiBlcnJvciBtZXNzYWdlLlxyXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBlcnJvck1lc3NhZ2UgLSBUaGUgZXJyb3IgbWVzc2FnZSB0byB0aHJvdy5cclxuICAgKiBAdGhyb3dzIHtFcnJvcn0gLSBBbHdheXMgdGhyb3dzIGFuIGVycm9yIHdpdGggdGhlIGdpdmVuIGVycm9yIG1lc3NhZ2UuXHJcbiAgICovXHJcbiAgZXhwb3J0IGZ1bmN0aW9uIHRocm93RXJyb3IoZXJyb3JNZXNzYWdlOiBzdHJpbmcpOiBuZXZlciB7XHJcbiAgICB0aHJvdyBuZXcgRXJyb3IoZXJyb3JNZXNzYWdlKTtcclxuICB9XHJcbiAgLyoqXHJcbiAgICogUmV0dXJucyBjdXJyZW50IHN0YXRlIG9mIGNsaWVudCB3aGV0aGVyIGl0J3Mgb25saW5lIG9yIG9mZmxpbmUuIFRoaXMgbWV0aG9kXHJcbiAgICogaXMgb2YgcXVzdGlvbmFibGUgdXNlZnVsbmVzcyBmb3IgaXQgcHJvdmlkZXMgbGl0dGxlIHRvIG5vIGJlbmVmaXQgb3ZlciB1c2luZ1xyXG4gICAqIHRoZSBuYXRpdmUgWHJtIFNESyBtZXRob2QuIFlvdSBkZWNpZGUsIGRlYXIgcHJvZ3JhbW1lciFcclxuICAgKiBAcmV0dXJucyBib29sZWFuXHJcbiAgICovXHJcbiAgZXhwb3J0IGZ1bmN0aW9uIGlzT2ZmbGluZSgpOiBib29sZWFuIHtcclxuICAgIHJldHVybiBYcm0uVXRpbGl0eS5nZXRHbG9iYWxDb250ZXh0KCkuY2xpZW50LmlzT2ZmbGluZSgpO1xyXG4gIH1cclxuICAvKipcclxuICAgKiBSZXR1cm5zIHRoZSBuYW1lIG9mIHRoZSBjYWxsaW5nIGZ1bmN0aW9uLlxyXG4gICAqIEByZXR1cm5zIHtzdHJpbmd9IC0gVGhlIG5hbWUgb2YgdGhlIGNhbGxpbmcgZnVuY3Rpb24uXHJcbiAgICovXHJcbiAgZXhwb3J0IGZ1bmN0aW9uIGdldEZ1bmN0aW9uTmFtZSgpOiBzdHJpbmcge1xyXG4gICAgdHJ5IHtcclxuICAgICAgY29uc3QgZXJyb3IgPSBuZXcgRXJyb3IoKTtcclxuICAgICAgY29uc3Qgc3RhY2tUcmFjZSA9IGVycm9yLnN0YWNrPy5zcGxpdChcIlxcblwiKS5tYXAoKGxpbmUpID0+IGxpbmUudHJpbSgpKTtcclxuICAgICAgY29uc3QgY2FsbGluZ0Z1bmN0aW9uTGluZSA9XHJcbiAgICAgICAgc3RhY2tUcmFjZSAmJiBzdGFja1RyYWNlLmxlbmd0aCA+PSAzID8gc3RhY2tUcmFjZVsyXSA6IHVuZGVmaW5lZDtcclxuICAgICAgY29uc3QgZnVuY3Rpb25OYW1lTWF0Y2ggPVxyXG4gICAgICAgIGNhbGxpbmdGdW5jdGlvbkxpbmU/Lm1hdGNoKC9hdFxccysoW15cXHNdKylcXHMrXFwoLykgfHxcclxuICAgICAgICBjYWxsaW5nRnVuY3Rpb25MaW5lPy5tYXRjaCgvYXRcXHMrKFteXFxzXSspLyk7XHJcbiAgICAgIGNvbnN0IGZ1bmN0aW9uTmFtZSA9IGZ1bmN0aW9uTmFtZU1hdGNoID8gZnVuY3Rpb25OYW1lTWF0Y2hbMV0gOiBcIlwiO1xyXG5cclxuICAgICAgcmV0dXJuIGZ1bmN0aW9uTmFtZTtcclxuICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcclxuICAgICAgdGhyb3cgbmV3IEVycm9yKGBYcm1FeC5nZXRGdW5jdGlvbk5hbWU6XFxuJHtlcnJvci5tZXNzYWdlfWApO1xyXG4gICAgfVxyXG4gIH1cclxuICAvKipcclxuICAgKiBEaXNwbGF5cyBhIG5vdGlmaWNhdGlvbiBmb3IgYW4gYXBwIHdpdGggdGhlIGdpdmVuIG1lc3NhZ2UgYW5kIGxldmVsLCBhbmQgbGV0cyB5b3Ugc3BlY2lmeSB3aGV0aGVyIHRvIHNob3cgYSBjbG9zZSBidXR0b24uXHJcbiAgICogQHBhcmFtIHtzdHJpbmd9IG1lc3NhZ2UgLSBUaGUgbWVzc2FnZSB0byBkaXNwbGF5IGluIHRoZSBub3RpZmljYXRpb24uXHJcbiAgICogQHBhcmFtIHsnU1VDQ0VTUycgfCAnRVJST1InIHwgJ1dBUk5JTkcnIHwgJ0lORk8nfSBsZXZlbCAtIFRoZSBsZXZlbCBvZiB0aGUgbm90aWZpY2F0aW9uLiBDYW4gYmUgJ1NVQ0NFU1MnLCAnRVJST1InLCAnV0FSTklORycsIG9yICdJTkZPJy5cclxuICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtzaG93Q2xvc2VCdXR0b249ZmFsc2VdIC0gV2hldGhlciB0byBzaG93IGEgY2xvc2UgYnV0dG9uIG9uIHRoZSBub3RpZmljYXRpb24uIERlZmF1bHRzIHRvIGZhbHNlLlxyXG4gICAqIEByZXR1cm5zIHtQcm9taXNlPHN0cmluZz59IC0gQSBwcm9taXNlIHRoYXQgcmVzb2x2ZXMgd2l0aCB0aGUgSUQgb2YgdGhlIGNyZWF0ZWQgbm90aWZpY2F0aW9uLlxyXG4gICAqL1xyXG4gIGV4cG9ydCBhc3luYyBmdW5jdGlvbiBhZGRHbG9iYWxOb3RpZmljYXRpb24oXHJcbiAgICBtZXNzYWdlOiBzdHJpbmcsXHJcbiAgICBsZXZlbDogXCJTVUNDRVNTXCIgfCBcIkVSUk9SXCIgfCBcIldBUk5JTkdcIiB8IFwiSU5GT1wiLFxyXG4gICAgc2hvd0Nsb3NlQnV0dG9uID0gZmFsc2VcclxuICApOiBQcm9taXNlPHN0cmluZz4ge1xyXG4gICAgY29uc3QgbGV2ZWxNYXAgPSB7XHJcbiAgICAgIFNVQ0NFU1M6IDEsXHJcbiAgICAgIEVSUk9SOiAyLFxyXG4gICAgICBXQVJOSU5HOiAzLFxyXG4gICAgICBJTkZPOiA0LFxyXG4gICAgfTtcclxuICAgIGNvbnN0IG1lc3NhZ2VMZXZlbCA9IGxldmVsTWFwW2xldmVsXSB8fCBsZXZlbE1hcC5JTkZPO1xyXG4gICAgY29uc3Qgbm90aWZpY2F0aW9uID0ge1xyXG4gICAgICB0eXBlOiAyLFxyXG4gICAgICBsZXZlbDogbWVzc2FnZUxldmVsLFxyXG4gICAgICBtZXNzYWdlLFxyXG4gICAgICBzaG93Q2xvc2VCdXR0b24sXHJcbiAgICB9O1xyXG4gICAgdHJ5IHtcclxuICAgICAgcmV0dXJuIGF3YWl0IFhybS5BcHAuYWRkR2xvYmFsTm90aWZpY2F0aW9uKG5vdGlmaWNhdGlvbik7XHJcbiAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XHJcbiAgICAgIHRocm93IG5ldyBFcnJvcihgWHJtRXguJHtnZXRGdW5jdGlvbk5hbWUoKX06XFxuJHtlcnJvci5tZXNzYWdlfWApO1xyXG4gICAgfVxyXG4gIH1cclxuICAvKipcclxuICAgKiBDbGVhcnMgYSBub3RpZmljYXRpb24gaW4gdGhlIGFwcCB3aXRoIHRoZSBnaXZlbiB1bmlxdWUgSUQuXHJcbiAgICogQHBhcmFtIHtzdHJpbmd9IHVuaXF1ZUlkIC0gVGhlIHVuaXF1ZSBJRCBvZiB0aGUgbm90aWZpY2F0aW9uIHRvIGNsZWFyLlxyXG4gICAqIEByZXR1cm5zIHtQcm9taXNlPHN0cmluZz59IC0gQSBwcm9taXNlIHRoYXQgcmVzb2x2ZXMgd2hlbiB0aGUgbm90aWZpY2F0aW9uIGhhcyBiZWVuIGNsZWFyZWQuXHJcbiAgICovXHJcbiAgZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJlbW92ZUdsb2JhbE5vdGlmaWNhdGlvbihcclxuICAgIHVuaXF1ZUlkOiBzdHJpbmdcclxuICApOiBQcm9taXNlPHN0cmluZz4ge1xyXG4gICAgdHJ5IHtcclxuICAgICAgcmV0dXJuIGF3YWl0IFhybS5BcHAuY2xlYXJHbG9iYWxOb3RpZmljYXRpb24odW5pcXVlSWQpO1xyXG4gICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFhybUV4LiR7Z2V0RnVuY3Rpb25OYW1lKCl9OlxcbiR7ZXJyb3IubWVzc2FnZX1gKTtcclxuICAgIH1cclxuICB9XHJcbiAgLyoqXHJcbiAgICogUmV0cmlldmVzIHRoZSB2YWx1ZSBvZiBhbiBlbnZpcm9ubWVudCB2YXJpYWJsZSBieSB1c2luZyBpdHMgc2NoZW1hIG5hbWUgYXMga2V5LlxyXG4gICAqIElmIHRoZSBlbnZpcm9ubWVudCB2YXJpYWJsZSBoYXMgYm90aCBhIGRlZmF1bHQgdmFsdWUgYW5kIGEgY3VycmVudCB2YWx1ZSwgdGhpcyBmdW5jdGlvbiB3aWxsIHJldHJpZXZlIHRoZSBjdXJyZW50IHZhbHVlLlxyXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBlbnZpcm9ubWVudFZhcmlhYmxlU2NoZW1hTmFtZSAtIFRoZSBzY2hlbWEgbmFtZSBvZiB0aGUgZW52aXJvbm1lbnQgdmFyaWFibGUgdG8gcmV0cmlldmUuXHJcbiAgICogQHJldHVybnMge1Byb21pc2U8c3RyaW5nPn0gLSBBIHByb21pc2UgdGhhdCByZXNvbHZlcyB3aXRoIHRoZSB2YWx1ZSBvZiB0aGUgZW52aXJvbm1lbnQgdmFyaWFibGUuXHJcbiAgICogQGFzeW5jXHJcbiAgICovXHJcbiAgZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdldEVudmlyb25tZW50VmFyaWFibGVWYWx1ZShcclxuICAgIGVudmlyb25tZW50VmFyaWFibGVTY2hlbWFOYW1lOiBzdHJpbmdcclxuICApOiBQcm9taXNlPHN0cmluZz4ge1xyXG4gICAgbGV0IHJlc3BvbnNlID0gYXdhaXQgZXhlY3V0ZUZ1bmN0aW9uKFwiUmV0cmlldmVFbnZpcm9ubWVudFZhcmlhYmxlVmFsdWVcIiwgW1xyXG4gICAgICB7XHJcbiAgICAgICAgTmFtZTogXCJEZWZpbml0aW9uU2NoZW1hTmFtZVwiLFxyXG4gICAgICAgIFR5cGU6IFwiU3RyaW5nXCIsXHJcbiAgICAgICAgVmFsdWU6IGVudmlyb25tZW50VmFyaWFibGVTY2hlbWFOYW1lLFxyXG4gICAgICB9LFxyXG4gICAgXSk7XHJcbiAgICByZXR1cm4gT2JqZWN0Lmhhc093bihyZXNwb25zZSwgXCJWYWx1ZVwiKSA/IHJlc3BvbnNlLlZhbHVlIDogcmVzcG9uc2U7XHJcbiAgfVxyXG4gIC8qKlxyXG4gICAqIEEgbWFwIG9mIENSTSBkYXRhIHR5cGVzIHRvIHRoZWlyIGNvcnJlc3BvbmRpbmcgdHlwZSBuYW1lcywgc3RydWN0dXJhbCBwcm9wZXJ0aWVzLCBhbmQgSmF2YVNjcmlwdCB0eXBlcy5cclxuICAgKiBAdHlwZSB7T2JqZWN0LjxzdHJpbmcsIHsgdHlwZU5hbWU6IHN0cmluZywgc3RydWN0dXJhbFByb3BlcnR5OiBudW1iZXIsIGpzVHlwZTogc3RyaW5nIH0+fVxyXG4gICAqL1xyXG4gIGxldCB0eXBlTWFwID0ge1xyXG4gICAgU3RyaW5nOiB7IHR5cGVOYW1lOiBcIkVkbS5TdHJpbmdcIiwgc3RydWN0dXJhbFByb3BlcnR5OiAxLCBqc1R5cGU6IFwic3RyaW5nXCIgfSxcclxuICAgIEludGVnZXI6IHsgdHlwZU5hbWU6IFwiRWRtLkludDMyXCIsIHN0cnVjdHVyYWxQcm9wZXJ0eTogMSwganNUeXBlOiBcIm51bWJlclwiIH0sXHJcbiAgICBCb29sZWFuOiB7XHJcbiAgICAgIHR5cGVOYW1lOiBcIkVkbS5Cb29sZWFuXCIsXHJcbiAgICAgIHN0cnVjdHVyYWxQcm9wZXJ0eTogMSxcclxuICAgICAganNUeXBlOiBcImJvb2xlYW5cIixcclxuICAgIH0sXHJcbiAgICBEYXRlVGltZToge1xyXG4gICAgICB0eXBlTmFtZTogXCJFZG0uRGF0ZVRpbWVPZmZzZXRcIixcclxuICAgICAgc3RydWN0dXJhbFByb3BlcnR5OiAxLFxyXG4gICAgICBqc1R5cGU6IFwib2JqZWN0XCIsXHJcbiAgICB9LFxyXG4gICAgRW50aXR5UmVmZXJlbmNlOiB7XHJcbiAgICAgIHR5cGVOYW1lOiBcIm1zY3JtLmNybWJhc2VlbnRpdHlcIixcclxuICAgICAgc3RydWN0dXJhbFByb3BlcnR5OiA1LFxyXG4gICAgICBqc1R5cGU6IFwib2JqZWN0XCIsXHJcbiAgICB9LFxyXG4gICAgRGVjaW1hbDoge1xyXG4gICAgICB0eXBlTmFtZTogXCJFZG0uRGVjaW1hbFwiLFxyXG4gICAgICBzdHJ1Y3R1cmFsUHJvcGVydHk6IDEsXHJcbiAgICAgIGpzVHlwZTogXCJudW1iZXJcIixcclxuICAgIH0sXHJcbiAgICBFbnRpdHk6IHtcclxuICAgICAgdHlwZU5hbWU6IFwibXNjcm0uY3JtYmFzZWVudGl0eVwiLFxyXG4gICAgICBzdHJ1Y3R1cmFsUHJvcGVydHk6IDUsXHJcbiAgICAgIGpzVHlwZTogXCJvYmplY3RcIixcclxuICAgIH0sXHJcbiAgICBFbnRpdHlDb2xsZWN0aW9uOiB7XHJcbiAgICAgIHR5cGVOYW1lOiBcIkNvbGxlY3Rpb24obXNjcm0uY3JtYmFzZWVudGl0eSlcIixcclxuICAgICAgc3RydWN0dXJhbFByb3BlcnR5OiA0LFxyXG4gICAgICBqc1R5cGU6IFwib2JqZWN0XCIsXHJcbiAgICB9LFxyXG4gICAgRmxvYXQ6IHsgdHlwZU5hbWU6IFwiRWRtLkRvdWJsZVwiLCBzdHJ1Y3R1cmFsUHJvcGVydHk6IDEsIGpzVHlwZTogXCJudW1iZXJcIiB9LFxyXG4gICAgTW9uZXk6IHsgdHlwZU5hbWU6IFwiRWRtLkRlY2ltYWxcIiwgc3RydWN0dXJhbFByb3BlcnR5OiAxLCBqc1R5cGU6IFwibnVtYmVyXCIgfSxcclxuICAgIFBpY2tsaXN0OiB7XHJcbiAgICAgIHR5cGVOYW1lOiBcIkVkbS5JbnQzMlwiLFxyXG4gICAgICBzdHJ1Y3R1cmFsUHJvcGVydHk6IDEsXHJcbiAgICAgIGpzVHlwZTogXCJudW1iZXJcIixcclxuICAgIH0sXHJcbiAgfTtcclxuICAvKipcclxuICAgKiBDaGVja3MgaWYgdGhlIGdpdmVuIHJlcXVlc3QgcGFyYW1ldGVyIGlzIG9mIGEgc3VwcG9ydGVkIHR5cGUgYW5kIGhhcyBhIHZhbGlkIHZhbHVlLlxyXG4gICAqIEBwYXJhbSB7UmVxdWVzdFBhcmFtZXRlcn0gcmVxdWVzdFBhcmFtZXRlciAtIFRoZSByZXF1ZXN0IHBhcmFtZXRlciB0byBjaGVjay5cclxuICAgKiBAcmV0dXJucyB7dm9pZH1cclxuICAgKiBAdGhyb3dzIHtFcnJvcn0gLSBUaHJvd3MgYW4gZXJyb3IgaWYgdGhlIHJlcXVlc3QgcGFyYW1ldGVyIGlzIG5vdCBvZiBhIHN1cHBvcnRlZCB0eXBlIG9yIGhhcyBhbiBpbnZhbGlkIHZhbHVlLlxyXG4gICAqL1xyXG4gIGV4cG9ydCBmdW5jdGlvbiBjaGVja1JlcXVlc3RQYXJhbWV0ZXJUeXBlKFxyXG4gICAgcmVxdWVzdFBhcmFtZXRlcjogUmVxdWVzdFBhcmFtZXRlclxyXG4gICk6IHZvaWQge1xyXG4gICAgaWYgKCF0eXBlTWFwW3JlcXVlc3RQYXJhbWV0ZXIuVHlwZV0pXHJcbiAgICAgIHRocm93IG5ldyBFcnJvcihcclxuICAgICAgICBgVGhlIHByb3BlcnR5IHR5cGUgJHtyZXF1ZXN0UGFyYW1ldGVyLlR5cGV9IG9mIHRoZSBwcm9wZXJ0eSAke3JlcXVlc3RQYXJhbWV0ZXIuTmFtZX0gaXMgbm90IHN1cHBvcnRlZC5gXHJcbiAgICAgICk7XHJcbiAgICBjb25zdCBleHBlY3RlZFR5cGUgPSB0eXBlTWFwW3JlcXVlc3RQYXJhbWV0ZXIuVHlwZV0uanNUeXBlO1xyXG4gICAgY29uc3QgYWN0dWFsVHlwZSA9IHR5cGVvZiByZXF1ZXN0UGFyYW1ldGVyLlZhbHVlO1xyXG4gICAgY29uc3QgaW52YWxpZFR5cGVNZXNzYWdlID0gYFRoZSB2YWx1ZSAke3JlcXVlc3RQYXJhbWV0ZXIuVmFsdWV9XFxub2YgdGhlIHByb3BlcnR5ICR7cmVxdWVzdFBhcmFtZXRlci5OYW1lfVxcbmlzIG5vdCBvZiB0aGUgZXhwZWN0ZWQgdHlwZSAke3JlcXVlc3RQYXJhbWV0ZXIuVHlwZX0uYDtcclxuICAgIGlmIChcclxuICAgICAgcmVxdWVzdFBhcmFtZXRlci5UeXBlID09PSBcIkVudGl0eVJlZmVyZW5jZVwiIHx8XHJcbiAgICAgIHJlcXVlc3RQYXJhbWV0ZXIuVHlwZSA9PT0gXCJFbnRpdHlcIlxyXG4gICAgKSB7XHJcbiAgICAgIGlmIChcclxuICAgICAgICAhcmVxdWVzdFBhcmFtZXRlci5WYWx1ZSB8fFxyXG4gICAgICAgICFyZXF1ZXN0UGFyYW1ldGVyLlZhbHVlLmhhc093blByb3BlcnR5KFwiaWRcIikgfHxcclxuICAgICAgICAhcmVxdWVzdFBhcmFtZXRlci5WYWx1ZS5oYXNPd25Qcm9wZXJ0eShcImVudGl0eVR5cGVcIilcclxuICAgICAgKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGludmFsaWRUeXBlTWVzc2FnZSk7XHJcbiAgICAgIH1cclxuICAgICAgdHlwZU1hcFtcclxuICAgICAgICByZXF1ZXN0UGFyYW1ldGVyLlR5cGVcclxuICAgICAgXS50eXBlTmFtZSA9IGBtc2NybS4ke3JlcXVlc3RQYXJhbWV0ZXIuVmFsdWUuZW50aXR5VHlwZX1gO1xyXG4gICAgfSBlbHNlIGlmIChyZXF1ZXN0UGFyYW1ldGVyLlR5cGUgPT09IFwiRW50aXR5Q29sbGVjdGlvblwiKSB7XHJcbiAgICAgIGlmIChcclxuICAgICAgICAhQXJyYXkuaXNBcnJheShyZXF1ZXN0UGFyYW1ldGVyLlZhbHVlKSB8fFxyXG4gICAgICAgIHJlcXVlc3RQYXJhbWV0ZXIuVmFsdWUuZXZlcnkoXHJcbiAgICAgICAgICAodikgPT5cclxuICAgICAgICAgICAgdHlwZW9mIHYgIT09IFwib2JqZWN0XCIgfHxcclxuICAgICAgICAgICAgIXYgfHxcclxuICAgICAgICAgICAgIXYuaGFzT3duUHJvcGVydHkoXCJpZFwiKSB8fFxyXG4gICAgICAgICAgICAhdi5oYXNPd25Qcm9wZXJ0eShcImVudGl0eVR5cGVcIilcclxuICAgICAgICApXHJcbiAgICAgICkge1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihpbnZhbGlkVHlwZU1lc3NhZ2UpO1xyXG4gICAgICB9XHJcbiAgICB9IGVsc2UgaWYgKHJlcXVlc3RQYXJhbWV0ZXIuVHlwZSA9PT0gXCJEYXRlVGltZVwiKSB7XHJcbiAgICAgIGlmICghKHJlcXVlc3RQYXJhbWV0ZXIuVmFsdWUgaW5zdGFuY2VvZiBEYXRlKSkge1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihpbnZhbGlkVHlwZU1lc3NhZ2UpO1xyXG4gICAgICB9XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICBpZiAoYWN0dWFsVHlwZSAhPT0gZXhwZWN0ZWRUeXBlKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGludmFsaWRUeXBlTWVzc2FnZSk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9XHJcbiAgLyoqXHJcbiAgICogRXhlY3V0ZXMgYW4gQWN0aW9uLlxyXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBhY3Rpb25OYW1lIC0gVGhlIHVuaXF1ZSBuYW1lIG9mIHRoZSBhY3Rpb24uXHJcbiAgICogQHBhcmFtIHtSZXF1ZXN0UGFyYW1ldGVyW119IHJlcXVlc3RQYXJhbWV0ZXJzIC0gQW4gYXJyYXkgb2Ygb2JqZWN0cyB3aXRoIHRoZSBwYXJhbWV0ZXIgbmFtZSwgdHlwZSBhbmQgdmFsdWUuXHJcbiAgICogQHBhcmFtIHtFbnRpdHlSZWZlcmVuY2V9IFtib3VuZEVudGl0eV0gLSBBbiBvcHRpb25hbCBFbnRpdHlSZWZlcmVuY2Ugb2YgdGhlIGJvdW5kIGVudGl0eS5cclxuICAgKiBAcmV0dXJucyB7UHJvbWlzZTxhbnk+fSAtIEEgUHJvbWlzZSB3aXRoIHRoZSByZXF1ZXN0IHJlc3BvbnNlLlxyXG4gICAqIEB0aHJvd3Mge0Vycm9yfSAtIFRocm93cyBhbiBlcnJvciBpZiB0aGUgcmVxdWVzdCBwYXJhbWV0ZXIgaXMgbm90IG9mIGEgc3VwcG9ydGVkIHR5cGUgb3IgaGFzIGFuIGludmFsaWQgdmFsdWUuXHJcbiAgICovXHJcbiAgZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGV4ZWN1dGVBY3Rpb24oXHJcbiAgICBhY3Rpb25OYW1lOiBzdHJpbmcsXHJcbiAgICByZXF1ZXN0UGFyYW1ldGVyczogUmVxdWVzdFBhcmFtZXRlcltdLFxyXG4gICAgYm91bmRFbnRpdHk/OiBFbnRpdHlSZWZlcmVuY2VcclxuICApOiBQcm9taXNlPGFueT4ge1xyXG4gICAgY29uc3QgcGFyYW1ldGVyRGVmaW5pdGlvbjogYW55ID0ge307XHJcbiAgICBpZiAoYm91bmRFbnRpdHkpXHJcbiAgICAgIHJlcXVlc3RQYXJhbWV0ZXJzLnB1c2goe1xyXG4gICAgICAgIE5hbWU6IFwiZW50aXR5XCIsXHJcbiAgICAgICAgVmFsdWU6IGJvdW5kRW50aXR5LFxyXG4gICAgICAgIFR5cGU6IFwiRW50aXR5UmVmZXJlbmNlXCIsXHJcbiAgICAgIH0pO1xyXG4gICAgZm9yIChjb25zdCByZXF1ZXN0UGFyYW1ldGVyIG9mIHJlcXVlc3RQYXJhbWV0ZXJzKSB7XHJcbiAgICAgIGNoZWNrUmVxdWVzdFBhcmFtZXRlclR5cGUocmVxdWVzdFBhcmFtZXRlcik7XHJcbiAgICAgIHBhcmFtZXRlckRlZmluaXRpb25bcmVxdWVzdFBhcmFtZXRlci5OYW1lXSA9IHtcclxuICAgICAgICB0eXBlTmFtZTogdHlwZU1hcFtyZXF1ZXN0UGFyYW1ldGVyLlR5cGVdLnR5cGVOYW1lLFxyXG4gICAgICAgIHN0cnVjdHVyYWxQcm9wZXJ0eTogdHlwZU1hcFtyZXF1ZXN0UGFyYW1ldGVyLlR5cGVdLnN0cnVjdHVyYWxQcm9wZXJ0eSxcclxuICAgICAgfTtcclxuICAgIH1cclxuICAgIGNvbnN0IHJlcSA9IE9iamVjdC5hc3NpZ24oXHJcbiAgICAgIHtcclxuICAgICAgICBnZXRNZXRhZGF0YTogKCkgPT4gKHtcclxuICAgICAgICAgIGJvdW5kUGFyYW1ldGVyOiBib3VuZEVudGl0eSA/IFwiZW50aXR5XCIgOiBudWxsLFxyXG4gICAgICAgICAgb3BlcmF0aW9uVHlwZTogMCxcclxuICAgICAgICAgIG9wZXJhdGlvbk5hbWU6IGFjdGlvbk5hbWUsXHJcbiAgICAgICAgICBwYXJhbWV0ZXJUeXBlczogcGFyYW1ldGVyRGVmaW5pdGlvbixcclxuICAgICAgICB9KSxcclxuICAgICAgfSxcclxuICAgICAgLi4ucmVxdWVzdFBhcmFtZXRlcnMubWFwKChwKSA9PiAoeyBbcC5OYW1lXTogcC5WYWx1ZSB9KSlcclxuICAgICk7XHJcbiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IFhybS5XZWJBcGkub25saW5lLmV4ZWN1dGUocmVxKTtcclxuICAgIGlmIChyZXNwb25zZS5vaykgcmV0dXJuIHJlc3BvbnNlLmpzb24oKS5jYXRjaCgoKSA9PiByZXNwb25zZSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBFeGVjdXRlcyBhIEZ1bmN0aW9uLlxyXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBmdW5jdGlvbk5hbWUgLSBUaGUgdW5pcXVlIG5hbWUgb2YgdGhlIGZ1bmN0aW9uLlxyXG4gICAqIEBwYXJhbSB7UmVxdWVzdFBhcmFtZXRlcltdfSByZXF1ZXN0UGFyYW1ldGVycyAtIEFuIGFycmF5IG9mIG9iamVjdHMgd2l0aCB0aGUgcGFyYW1ldGVyIG5hbWUsIHR5cGUgYW5kIHZhbHVlLlxyXG4gICAqIEBwYXJhbSB7RW50aXR5UmVmZXJlbmNlfSBbYm91bmRFbnRpdHldIC0gQW4gb3B0aW9uYWwgRW50aXR5UmVmZXJlbmNlIG9mIHRoZSBib3VuZCBlbnRpdHkuXHJcbiAgICogQHJldHVybnMge1Byb21pc2U8YW55Pn0gLSBBIFByb21pc2Ugd2l0aCB0aGUgcmVxdWVzdCByZXNwb25zZS5cclxuICAgKiBAdGhyb3dzIHtFcnJvcn0gLSBUaHJvd3MgYW4gZXJyb3IgaWYgdGhlIHJlcXVlc3QgcGFyYW1ldGVyIGlzIG5vdCBvZiBhIHN1cHBvcnRlZCB0eXBlIG9yIGhhcyBhbiBpbnZhbGlkIHZhbHVlLlxyXG4gICAqL1xyXG4gIGV4cG9ydCBhc3luYyBmdW5jdGlvbiBleGVjdXRlRnVuY3Rpb24oXHJcbiAgICBmdW5jdGlvbk5hbWU6IHN0cmluZyxcclxuICAgIHJlcXVlc3RQYXJhbWV0ZXJzOiBSZXF1ZXN0UGFyYW1ldGVyW10sXHJcbiAgICBib3VuZEVudGl0eT86IEVudGl0eVJlZmVyZW5jZVxyXG4gICk6IFByb21pc2U8YW55PiB7XHJcbiAgICBjb25zdCBwYXJhbWV0ZXJEZWZpbml0aW9uOiBhbnkgPSB7fTtcclxuICAgIGlmIChib3VuZEVudGl0eSlcclxuICAgICAgcmVxdWVzdFBhcmFtZXRlcnMucHVzaCh7XHJcbiAgICAgICAgTmFtZTogXCJlbnRpdHlcIixcclxuICAgICAgICBWYWx1ZTogYm91bmRFbnRpdHksXHJcbiAgICAgICAgVHlwZTogXCJFbnRpdHlSZWZlcmVuY2VcIixcclxuICAgICAgfSk7XHJcbiAgICBmb3IgKGNvbnN0IHJlcXVlc3RQYXJhbWV0ZXIgb2YgcmVxdWVzdFBhcmFtZXRlcnMpIHtcclxuICAgICAgY2hlY2tSZXF1ZXN0UGFyYW1ldGVyVHlwZShyZXF1ZXN0UGFyYW1ldGVyKTtcclxuICAgICAgcGFyYW1ldGVyRGVmaW5pdGlvbltyZXF1ZXN0UGFyYW1ldGVyLk5hbWVdID0ge1xyXG4gICAgICAgIHR5cGVOYW1lOiB0eXBlTWFwW3JlcXVlc3RQYXJhbWV0ZXIuVHlwZV0udHlwZU5hbWUsXHJcbiAgICAgICAgc3RydWN0dXJhbFByb3BlcnR5OiB0eXBlTWFwW3JlcXVlc3RQYXJhbWV0ZXIuVHlwZV0uc3RydWN0dXJhbFByb3BlcnR5LFxyXG4gICAgICB9O1xyXG4gICAgfVxyXG4gICAgY29uc3QgcmVxID0gT2JqZWN0LmFzc2lnbihcclxuICAgICAge1xyXG4gICAgICAgIGdldE1ldGFkYXRhOiAoKSA9PiAoe1xyXG4gICAgICAgICAgYm91bmRQYXJhbWV0ZXI6IGJvdW5kRW50aXR5ID8gXCJlbnRpdHlcIiA6IG51bGwsXHJcbiAgICAgICAgICBvcGVyYXRpb25UeXBlOiAxLFxyXG4gICAgICAgICAgb3BlcmF0aW9uTmFtZTogZnVuY3Rpb25OYW1lLFxyXG4gICAgICAgICAgcGFyYW1ldGVyVHlwZXM6IHBhcmFtZXRlckRlZmluaXRpb24sXHJcbiAgICAgICAgfSksXHJcbiAgICAgIH0sXHJcbiAgICAgIC4uLnJlcXVlc3RQYXJhbWV0ZXJzLm1hcCgocCkgPT4gKHsgW3AuTmFtZV06IHAuVmFsdWUgfSkpXHJcbiAgICApO1xyXG4gICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBYcm0uV2ViQXBpLm9ubGluZS5leGVjdXRlKHJlcSk7XHJcbiAgICBpZiAocmVzcG9uc2Uub2spIHJldHVybiByZXNwb25zZS5qc29uKCkuY2F0Y2goKCkgPT4gcmVzcG9uc2UpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogTWFrZXMgYSBHVUlEIGxvd2VyY2FzZSBhbmQgcmVtb3ZlcyBicmFja2V0cy5cclxuICAgKiBAcGFyYW0ge3N0cmluZ30gZ3VpZCAtIFRoZSBHVUlEIHRvIG5vcm1hbGl6ZS5cclxuICAgKiBAcmV0dXJucyB7c3RyaW5nfSAtIFRoZSBub3JtYWxpemVkIEdVSUQuXHJcbiAgICovXHJcbiAgZXhwb3J0IGZ1bmN0aW9uIG5vcm1hbGl6ZUd1aWQoZ3VpZDogc3RyaW5nKTogc3RyaW5nIHtcclxuICAgIGlmICh0eXBlb2YgZ3VpZCAhPT0gXCJzdHJpbmdcIilcclxuICAgICAgdGhyb3cgbmV3IEVycm9yKGBYcm1FeC5ub3JtYWxpemVHdWlkOlxcbicke2d1aWR9JyBpcyBub3QgYSBzdHJpbmdgKTtcclxuICAgIHJldHVybiBndWlkLnRvTG93ZXJDYXNlKCkucmVwbGFjZSgvW3t9XS9nLCBcIlwiKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFdyYXBzIGEgZnVuY3Rpb24gdGhhdCB0YWtlcyBhIGNhbGxiYWNrIGFzIGl0cyBsYXN0IHBhcmFtZXRlciBhbmQgcmV0dXJucyBhIFByb21pc2UuXHJcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gZm4gdGhlIGZ1bmN0aW9uIHRvIHdyYXBcclxuICAgKiBAcGFyYW0gY29udGV4dCB0aGUgcGFyZW50IHByb3BlcnR5IG9mIHRoZSBmdW5jdGlvbiBmLmUuIGZvcm1Db250ZXh0LmRhdGEucHJvY2VzcyBmb3IgZm9ybUNvbnRleHQuZGF0YS5wcm9jZXNzLmdldEVuYWJsZWRQcm9jZXNzZXNcclxuICAgKiBAcGFyYW0gYXJncyB0aGUgYXJndW1lbnRzIHRvIHBhc3MgdG8gdGhlIGZ1bmN0aW9uXHJcbiAgICogQHJldHVybnMge1Byb21pc2U8YW55Pn0gYSBQcm9taXNlIHRoYXQgcmVzb2x2ZXMgd2l0aCB0aGUgY2FsbGJhY2sgcmVzcG9uc2VcclxuICAgKi9cclxuICBleHBvcnQgZnVuY3Rpb24gYXNQcm9taXNlPFQ+KGZuOiBGdW5jdGlvbiwgY29udGV4dCwgLi4uYXJncyk6IFByb21pc2U8VD4ge1xyXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlPFQ+KChyZXNvbHZlLCByZWplY3QpID0+IHtcclxuICAgICAgY29uc3QgY2FsbGJhY2sgPSAocmVzcG9uc2U6IFQpID0+IHtcclxuICAgICAgICByZXNvbHZlKHJlc3BvbnNlKTtcclxuICAgICAgfTtcclxuICAgICAgdHJ5IHtcclxuICAgICAgICAvLyBDYWxsIHRoZSBmdW5jdGlvbiB3aXRoIHRoZSBhcmd1bWVudHMgYW5kIHRoZSBjYWxsYmFjayBhdCB0aGUgZW5kXHJcbiAgICAgICAgZm4uY2FsbChjb250ZXh0LCAuLi5hcmdzLCBjYWxsYmFjayk7XHJcbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgICAgcmVqZWN0KGVycm9yKTtcclxuICAgICAgfVxyXG4gICAgfSk7XHJcbiAgfVxyXG4gIC8qKlxyXG4gICAqIE9wZW5zIGEgZGlhbG9nIHdpdGggZHluYW1pYyBoZWlnaHQgYW5kIHdpZHRoIGJhc2VkIG9uIHRleHQgY29udGVudC5cclxuICAgKiBAcGFyYW0ge3N0cmluZ30gdGl0bGUgLSBUaGUgdGl0bGUgb2YgdGhlIGRpYWxvZy5cclxuICAgKiBAcGFyYW0ge3N0cmluZ30gdGV4dCAtIFRoZSB0ZXh0IGNvbnRlbnQgb2YgdGhlIGRpYWxvZy5cclxuICAgKiBAcmV0dXJucyB7UHJvbWlzZTxhbnk+fSAtIEEgUHJvbWlzZSB3aXRoIHRoZSBkaWFsb2cgcmVzcG9uc2UuXHJcbiAgICovXHJcbiAgZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIG9wZW5BbGVydERpYWxvZyhcclxuICAgIHRpdGxlOiBzdHJpbmcsXHJcbiAgICB0ZXh0OiBzdHJpbmdcclxuICApOiBQcm9taXNlPGFueT4ge1xyXG4gICAgdHJ5IHtcclxuICAgICAgY29uc3Qgcm93cyA9IHRleHQuc3BsaXQoL1xcclxcbnxcXHJ8XFxuLyk7XHJcbiAgICAgIGxldCBhZGRpdGlvbmFsUm93cyA9IDA7XHJcbiAgICAgIHJvd3MuZm9yRWFjaCgocm93KSA9PiB7XHJcbiAgICAgICAgbGV0IHdpZHRoID0gZ2V0VGV4dFdpZHRoKFxyXG4gICAgICAgICAgcm93LFxyXG4gICAgICAgICAgXCIxcmVtIFNlZ29lIFVJIFJlZ3VsYXIsIFNlZ29lVUksIFNlZ29lIFVJXCJcclxuICAgICAgICApO1xyXG4gICAgICAgIGlmICh3aWR0aCA+IDk0MCkge1xyXG4gICAgICAgICAgYWRkaXRpb25hbFJvd3MgKz0gd2lkdGggLyA5NDA7XHJcbiAgICAgICAgfVxyXG4gICAgICB9KTtcclxuICAgICAgY29uc3QgbG9uZ2VzdFJvdyA9IHJvd3MucmVkdWNlKFxyXG4gICAgICAgIChhY2MsIHJvdykgPT4gKHJvdy5sZW5ndGggPiBhY2MubGVuZ3RoID8gcm93IDogYWNjKSxcclxuICAgICAgICBcIlwiXHJcbiAgICAgICk7XHJcbiAgICAgIGNvbnN0IHdpZHRoID0gTWF0aC5taW4oXHJcbiAgICAgICAgZ2V0VGV4dFdpZHRoKGxvbmdlc3RSb3csIFwiMXJlbSBTZWdvZSBVSSBSZWd1bGFyLCBTZWdvZVVJLCBTZWdvZSBVSVwiKSxcclxuICAgICAgICAxMDAwXHJcbiAgICAgICk7XHJcbiAgICAgIGNvbnN0IGhlaWdodCA9IDEwOSArIChyb3dzLmxlbmd0aCArIGFkZGl0aW9uYWxSb3dzKSAqIDIwO1xyXG4gICAgICByZXR1cm4gYXdhaXQgWHJtLk5hdmlnYXRpb24ub3BlbkFsZXJ0RGlhbG9nKFxyXG4gICAgICAgIHtcclxuICAgICAgICAgIGNvbmZpcm1CdXR0b25MYWJlbDogXCJPa1wiLFxyXG4gICAgICAgICAgdGV4dCxcclxuICAgICAgICAgIHRpdGxlLFxyXG4gICAgICAgIH0sXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgaGVpZ2h0LFxyXG4gICAgICAgICAgd2lkdGgsXHJcbiAgICAgICAgfVxyXG4gICAgICApO1xyXG4gICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xyXG4gICAgICBjb25zb2xlLmVycm9yKGVycm9yLm1lc3NhZ2UpO1xyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFhybUV4LiR7Z2V0RnVuY3Rpb25OYW1lKCl9OlxcbiR7ZXJyb3IubWVzc2FnZX1gKTtcclxuICAgIH1cclxuICAgIC8qKlxyXG4gICAgICogVXNlcyBjYW52YXMubWVhc3VyZVRleHQgdG8gY29tcHV0ZSBhbmQgcmV0dXJuIHRoZSB3aWR0aCBvZiB0aGUgZ2l2ZW4gdGV4dCBvZiBnaXZlbiBmb250IGluIHBpeGVscy5cclxuICAgICAqXHJcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gdGV4dCBUaGUgdGV4dCB0byBiZSByZW5kZXJlZC5cclxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBmb250IFRoZSBjc3MgZm9udCBkZXNjcmlwdG9yIHRoYXQgdGV4dCBpcyB0byBiZSByZW5kZXJlZCB3aXRoIChlLmcuIFwiYm9sZCAxNHB4IHZlcmRhbmFcIikuXHJcbiAgICAgKlxyXG4gICAgICogQHNlZSBodHRwczovL3N0YWNrb3ZlcmZsb3cuY29tL3F1ZXN0aW9ucy8xMTgyNDEvY2FsY3VsYXRlLXRleHQtd2lkdGgtd2l0aC1qYXZhc2NyaXB0LzIxMDE1MzkzIzIxMDE1MzkzXHJcbiAgICAgKi9cclxuICAgIGZ1bmN0aW9uIGdldFRleHRXaWR0aCh0ZXh0OiBzdHJpbmcsIGZvbnQ6IHN0cmluZykge1xyXG4gICAgICBjb25zdCBjYW52YXMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiY2FudmFzXCIpO1xyXG4gICAgICBjb25zdCBjb250ZXh0ID0gY2FudmFzLmdldENvbnRleHQoXCIyZFwiKTtcclxuICAgICAgY29udGV4dC5mb250ID0gZm9udDtcclxuICAgICAgY29uc3QgbWV0cmljcyA9IGNvbnRleHQubWVhc3VyZVRleHQodGV4dCk7XHJcbiAgICAgIHJldHVybiBtZXRyaWNzLndpZHRoO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgZXhwb3J0IGNsYXNzIFByb2Nlc3Mge1xyXG4gICAgc3RhdGljIGdldCBkYXRhKCkge1xyXG4gICAgICByZXR1cm4gRm9ybS5mb3JtQ29udGV4dC5kYXRhLnByb2Nlc3M7XHJcbiAgICB9XHJcbiAgICBzdGF0aWMgZ2V0IHVpKCkge1xyXG4gICAgICByZXR1cm4gRm9ybS5mb3JtQ29udGV4dC51aS5wcm9jZXNzO1xyXG4gICAgfVxyXG4gICAgLyoqXHJcbiAgICAgKiBVc2UgdGhpcyB0byBhZGQgYSBmdW5jdGlvbiBhcyBhbiBldmVudCBoYW5kbGVyIGZvciB0aGUgT25QcmVQcm9jZXNzU3RhdHVzQ2hhbmdlIGV2ZW50IHNvIHRoYXQgaXQgd2lsbCBiZSBjYWxsZWQgYmVmb3JlIHRoZVxyXG4gICAgICogYnVzaW5lc3MgcHJvY2VzcyBmbG93IHN0YXR1cyBjaGFuZ2VzLlxyXG4gICAgICogQHBhcmFtIGhhbmRsZXIgVGhlIGZ1bmN0aW9uIHdpbGwgYmUgYWRkZWQgdG8gdGhlIGJvdHRvbSBvZiB0aGUgZXZlbnRcclxuICAgICAqICAgICAgICAgICAgICAgIGhhbmRsZXIgcGlwZWxpbmUuIFRoZSBleGVjdXRpb24gY29udGV4dCBpcyBhdXRvbWF0aWNhbGx5XHJcbiAgICAgKiAgICAgICAgICAgICAgICBzZXQgdG8gYmUgdGhlIGZpcnN0IHBhcmFtZXRlciBwYXNzZWQgdG8gdGhlIGV2ZW50IGhhbmRsZXIuXHJcbiAgICAgKiAgICAgICAgICAgICAgICBVc2UgYSByZWZlcmVuY2UgdG8gYSBuYW1lZCBmdW5jdGlvbiByYXRoZXIgdGhhbiBhblxyXG4gICAgICogICAgICAgICAgICAgICAgYW5vbnltb3VzIGZ1bmN0aW9uIGlmIHlvdSBtYXkgbGF0ZXIgd2FudCB0byByZW1vdmUgdGhlXHJcbiAgICAgKiAgICAgICAgICAgICAgICBldmVudCBoYW5kbGVyLlxyXG4gICAgICovXHJcbiAgICBzdGF0aWMgYWRkT25QcmVQcm9jZXNzU3RhdHVzQ2hhbmdlKFxyXG4gICAgICBoYW5kbGVyOiBYcm0uRXZlbnRzLlByb2Nlc3NTdGF0dXNDaGFuZ2VIYW5kbGVyXHJcbiAgICApIHtcclxuICAgICAgRm9ybS5mb3JtQ29udGV4dC5kYXRhLnByb2Nlc3MucmVtb3ZlT25QcmVQcm9jZXNzU3RhdHVzQ2hhbmdlKGhhbmRsZXIpO1xyXG4gICAgICByZXR1cm4gRm9ybS5mb3JtQ29udGV4dC5kYXRhLnByb2Nlc3MuYWRkT25QcmVQcm9jZXNzU3RhdHVzQ2hhbmdlKGhhbmRsZXIpO1xyXG4gICAgfVxyXG4gICAgLyoqXHJcbiAgICAgKiBVc2UgdGhpcyB0byBhZGQgYSBmdW5jdGlvbiBhcyBhbiBldmVudCBoYW5kbGVyIGZvciB0aGUgT25QcmVTdGFnZUNoYW5nZSBldmVudCBzbyB0aGF0IGl0IHdpbGwgYmUgY2FsbGVkIGJlZm9yZSB0aGVcclxuICAgICAqIGJ1c2luZXNzIHByb2Nlc3MgZmxvdyBzdGFnZSBjaGFuZ2VzLlxyXG4gICAgICogQHBhcmFtIGhhbmRsZXIgVGhlIGZ1bmN0aW9uIHdpbGwgYmUgYWRkZWQgdG8gdGhlIGJvdHRvbSBvZiB0aGUgZXZlbnRcclxuICAgICAqICAgICAgICAgICAgICAgIGhhbmRsZXIgcGlwZWxpbmUuIFRoZSBleGVjdXRpb24gY29udGV4dCBpcyBhdXRvbWF0aWNhbGx5XHJcbiAgICAgKiAgICAgICAgICAgICAgICBzZXQgdG8gYmUgdGhlIGZpcnN0IHBhcmFtZXRlciBwYXNzZWQgdG8gdGhlIGV2ZW50IGhhbmRsZXIuXHJcbiAgICAgKiAgICAgICAgICAgICAgICBVc2UgYSByZWZlcmVuY2UgdG8gYSBuYW1lZCBmdW5jdGlvbiByYXRoZXIgdGhhbiBhblxyXG4gICAgICogICAgICAgICAgICAgICAgYW5vbnltb3VzIGZ1bmN0aW9uIGlmIHlvdSBtYXkgbGF0ZXIgd2FudCB0byByZW1vdmUgdGhlXHJcbiAgICAgKiAgICAgICAgICAgICAgICBldmVudCBoYW5kbGVyLlxyXG4gICAgICovXHJcbiAgICBzdGF0aWMgYWRkT25QcmVTdGFnZUNoYW5nZShoYW5kbGVyOiBYcm0uRXZlbnRzLlN0YWdlQ2hhbmdlRXZlbnRIYW5kbGVyKSB7XHJcbiAgICAgIEZvcm0uZm9ybUNvbnRleHQuZGF0YS5wcm9jZXNzLnJlbW92ZU9uUHJlU3RhZ2VDaGFuZ2UoaGFuZGxlcik7XHJcbiAgICAgIHJldHVybiBGb3JtLmZvcm1Db250ZXh0LmRhdGEucHJvY2Vzcy5hZGRPblByZVN0YWdlQ2hhbmdlKGhhbmRsZXIpO1xyXG4gICAgfVxyXG4gICAgLyoqXHJcbiAgICAgKiBVc2UgdGhpcyB0byBhZGQgYSBmdW5jdGlvbiBhcyBhbiBldmVudCBoYW5kbGVyIGZvciB0aGUgT25QcmVQcm9jZXNzU3RhdHVzQ2hhbmdlIGV2ZW50IHNvIHRoYXQgaXQgd2lsbCBiZSBjYWxsZWQgd2hlbiB0aGVcclxuICAgICAqIGJ1c2luZXNzIHByb2Nlc3MgZmxvdyBzdGF0dXMgY2hhbmdlcy5cclxuICAgICAqIEBwYXJhbSBoYW5kbGVyIFRoZSBmdW5jdGlvbiB3aWxsIGJlIGFkZGVkIHRvIHRoZSBib3R0b20gb2YgdGhlIGV2ZW50XHJcbiAgICAgKiAgICAgICAgICAgICAgICBoYW5kbGVyIHBpcGVsaW5lLiBUaGUgZXhlY3V0aW9uIGNvbnRleHQgaXMgYXV0b21hdGljYWxseVxyXG4gICAgICogICAgICAgICAgICAgICAgc2V0IHRvIGJlIHRoZSBmaXJzdCBwYXJhbWV0ZXIgcGFzc2VkIHRvIHRoZSBldmVudCBoYW5kbGVyLlxyXG4gICAgICogICAgICAgICAgICAgICAgVXNlIGEgcmVmZXJlbmNlIHRvIGEgbmFtZWQgZnVuY3Rpb24gcmF0aGVyIHRoYW4gYW5cclxuICAgICAqICAgICAgICAgICAgICAgIGFub255bW91cyBmdW5jdGlvbiBpZiB5b3UgbWF5IGxhdGVyIHdhbnQgdG8gcmVtb3ZlIHRoZVxyXG4gICAgICogICAgICAgICAgICAgICAgZXZlbnQgaGFuZGxlci5cclxuICAgICAqL1xyXG4gICAgc3RhdGljIGFkZE9uUHJvY2Vzc1N0YXR1c0NoYW5nZShcclxuICAgICAgaGFuZGxlcjogWHJtLkV2ZW50cy5Qcm9jZXNzU3RhdHVzQ2hhbmdlSGFuZGxlclxyXG4gICAgKSB7XHJcbiAgICAgIEZvcm0uZm9ybUNvbnRleHQuZGF0YS5wcm9jZXNzLnJlbW92ZU9uUHJvY2Vzc1N0YXR1c0NoYW5nZShoYW5kbGVyKTtcclxuICAgICAgcmV0dXJuIEZvcm0uZm9ybUNvbnRleHQuZGF0YS5wcm9jZXNzLmFkZE9uUHJvY2Vzc1N0YXR1c0NoYW5nZShoYW5kbGVyKTtcclxuICAgIH1cclxuICAgIC8qKlxyXG4gICAgICogVXNlIHRoaXMgdG8gYWRkIGEgZnVuY3Rpb24gYXMgYW4gZXZlbnQgaGFuZGxlciBmb3IgdGhlIE9uU3RhZ2VDaGFuZ2UgZXZlbnQgc28gdGhhdCBpdCB3aWxsIGJlIGNhbGxlZCB3aGVuIHRoZVxyXG4gICAgICogYnVzaW5lc3MgcHJvY2VzcyBmbG93IHN0YWdlIGNoYW5nZXMuXHJcbiAgICAgKiBAcGFyYW0gaGFuZGxlciBUaGUgZnVuY3Rpb24gd2lsbCBiZSBhZGRlZCB0byB0aGUgYm90dG9tIG9mIHRoZSBldmVudFxyXG4gICAgICogICAgICAgICAgICAgICAgaGFuZGxlciBwaXBlbGluZS4gVGhlIGV4ZWN1dGlvbiBjb250ZXh0IGlzIGF1dG9tYXRpY2FsbHlcclxuICAgICAqICAgICAgICAgICAgICAgIHNldCB0byBiZSB0aGUgZmlyc3QgcGFyYW1ldGVyIHBhc3NlZCB0byB0aGUgZXZlbnQgaGFuZGxlci5cclxuICAgICAqICAgICAgICAgICAgICAgIFVzZSBhIHJlZmVyZW5jZSB0byBhIG5hbWVkIGZ1bmN0aW9uIHJhdGhlciB0aGFuIGFuXHJcbiAgICAgKiAgICAgICAgICAgICAgICBhbm9ueW1vdXMgZnVuY3Rpb24gaWYgeW91IG1heSBsYXRlciB3YW50IHRvIHJlbW92ZSB0aGVcclxuICAgICAqICAgICAgICAgICAgICAgIGV2ZW50IGhhbmRsZXIuXHJcbiAgICAgKi9cclxuICAgIHN0YXRpYyBhZGRPblN0YWdlQ2hhbmdlKGhhbmRsZXI6IFhybS5FdmVudHMuU3RhZ2VDaGFuZ2VFdmVudEhhbmRsZXIpIHtcclxuICAgICAgRm9ybS5mb3JtQ29udGV4dC5kYXRhLnByb2Nlc3MucmVtb3ZlT25TdGFnZUNoYW5nZShoYW5kbGVyKTtcclxuICAgICAgcmV0dXJuIEZvcm0uZm9ybUNvbnRleHQuZGF0YS5wcm9jZXNzLmFkZE9uU3RhZ2VDaGFuZ2UoaGFuZGxlcik7XHJcbiAgICB9XHJcbiAgICAvKipcclxuICAgICAqIFVzZSB0aGlzIHRvIGFkZCBhIGZ1bmN0aW9uIGFzIGFuIGV2ZW50IGhhbmRsZXIgZm9yIHRoZSBPblN0YWdlU2VsZWN0ZWQgZXZlbnQgc28gdGhhdCBpdCB3aWxsIGJlIGNhbGxlZFxyXG4gICAgICogd2hlbiBhIGJ1c2luZXNzIHByb2Nlc3MgZmxvdyBzdGFnZSBpcyBzZWxlY3RlZC5cclxuICAgICAqIEBwYXJhbSBoYW5kbGVyIFRoZSBmdW5jdGlvbiB3aWxsIGJlIGFkZGVkIHRvIHRoZSBib3R0b20gb2YgdGhlIGV2ZW50XHJcbiAgICAgKiAgICAgICAgICAgICAgICBoYW5kbGVyIHBpcGVsaW5lLiBUaGUgZXhlY3V0aW9uIGNvbnRleHQgaXMgYXV0b21hdGljYWxseVxyXG4gICAgICogICAgICAgICAgICAgICAgc2V0IHRvIGJlIHRoZSBmaXJzdCBwYXJhbWV0ZXIgcGFzc2VkIHRvIHRoZSBldmVudCBoYW5kbGVyLlxyXG4gICAgICogICAgICAgICAgICAgICAgVXNlIGEgcmVmZXJlbmNlIHRvIGEgbmFtZWQgZnVuY3Rpb24gcmF0aGVyIHRoYW4gYW5cclxuICAgICAqICAgICAgICAgICAgICAgIGFub255bW91cyBmdW5jdGlvbiBpZiB5b3UgbWF5IGxhdGVyIHdhbnQgdG8gcmVtb3ZlIHRoZVxyXG4gICAgICogICAgICAgICAgICAgICAgZXZlbnQgaGFuZGxlci5cclxuICAgICAqL1xyXG4gICAgc3RhdGljIGFkZE9uU3RhZ2VTZWxlY3RlZChoYW5kbGVyOiBYcm0uRXZlbnRzLkNvbnRleHRTZW5zaXRpdmVIYW5kbGVyKSB7XHJcbiAgICAgIEZvcm0uZm9ybUNvbnRleHQuZGF0YS5wcm9jZXNzLnJlbW92ZU9uU3RhZ2VTZWxlY3RlZChoYW5kbGVyKTtcclxuICAgICAgcmV0dXJuIEZvcm0uZm9ybUNvbnRleHQuZGF0YS5wcm9jZXNzLmFkZE9uU3RhZ2VTZWxlY3RlZChoYW5kbGVyKTtcclxuICAgIH1cclxuICAgIC8qKlxyXG4gICAgICogVXNlIHRoaXMgdG8gcmVtb3ZlIGEgZnVuY3Rpb24gYXMgYW4gZXZlbnQgaGFuZGxlciBmb3IgdGhlIE9uUHJlUHJvY2Vzc1N0YXR1c0NoYW5nZSBldmVudC5cclxuICAgICAqIEBwYXJhbSBoYW5kbGVyIElmIGFuIGFub255bW91cyBmdW5jdGlvbiBpcyBzZXQgdXNpbmcgdGhlIGFkZE9uUHJlUHJvY2Vzc1N0YXR1c0NoYW5nZSBtZXRob2QgaXRcclxuICAgICAqICAgICAgICAgICAgICAgIGNhbm5vdCBiZSByZW1vdmVkIHVzaW5nIHRoaXMgbWV0aG9kLlxyXG4gICAgICovXHJcbiAgICBzdGF0aWMgcmVtb3ZlT25QcmVQcm9jZXNzU3RhdHVzQ2hhbmdlKFxyXG4gICAgICBoYW5kbGVyOiBYcm0uRXZlbnRzLlByb2Nlc3NTdGF0dXNDaGFuZ2VIYW5kbGVyXHJcbiAgICApIHtcclxuICAgICAgcmV0dXJuIEZvcm0uZm9ybUNvbnRleHQuZGF0YS5wcm9jZXNzLnJlbW92ZU9uUHJlUHJvY2Vzc1N0YXR1c0NoYW5nZShcclxuICAgICAgICBoYW5kbGVyXHJcbiAgICAgICk7XHJcbiAgICB9XHJcbiAgICAvKipcclxuICAgICAqIFVzZSB0aGlzIHRvIHJlbW92ZSBhIGZ1bmN0aW9uIGFzIGFuIGV2ZW50IGhhbmRsZXIgZm9yIHRoZSBPblByZVN0YWdlQ2hhbmdlIGV2ZW50LlxyXG4gICAgICogQHBhcmFtIGhhbmRsZXIgSWYgYW4gYW5vbnltb3VzIGZ1bmN0aW9uIGlzIHNldCB1c2luZyB0aGUgYWRkT25QcmVTdGFnZUNoYW5nZSBtZXRob2QgaXRcclxuICAgICAqICAgICAgICAgICAgICAgIGNhbm5vdCBiZSByZW1vdmVkIHVzaW5nIHRoaXMgbWV0aG9kLlxyXG4gICAgICovXHJcbiAgICBzdGF0aWMgcmVtb3ZlT25QcmVTdGFnZUNoYW5nZShoYW5kbGVyOiBYcm0uRXZlbnRzLlN0YWdlQ2hhbmdlRXZlbnRIYW5kbGVyKSB7XHJcbiAgICAgIHJldHVybiBGb3JtLmZvcm1Db250ZXh0LmRhdGEucHJvY2Vzcy5yZW1vdmVPblByZVN0YWdlQ2hhbmdlKGhhbmRsZXIpO1xyXG4gICAgfVxyXG4gICAgLyoqXHJcbiAgICAgKiBVc2UgdGhpcyB0byByZW1vdmUgYSBmdW5jdGlvbiBhcyBhbiBldmVudCBoYW5kbGVyIGZvciB0aGUgT25Qcm9jZXNzU3RhdHVzQ2hhbmdlIGV2ZW50LlxyXG4gICAgICogQHBhcmFtIGhhbmRsZXIgSWYgYW4gYW5vbnltb3VzIGZ1bmN0aW9uIGlzIHNldCB1c2luZyB0aGUgYWRkT25Qcm9jZXNzU3RhdHVzQ2hhbmdlIG1ldGhvZCBpdFxyXG4gICAgICogICAgICAgICAgICAgICAgY2Fubm90IGJlIHJlbW92ZWQgdXNpbmcgdGhpcyBtZXRob2QuXHJcbiAgICAgKi9cclxuICAgIHN0YXRpYyByZW1vdmVPblByb2Nlc3NTdGF0dXNDaGFuZ2UoXHJcbiAgICAgIGhhbmRsZXI6IFhybS5FdmVudHMuUHJvY2Vzc1N0YXR1c0NoYW5nZUhhbmRsZXJcclxuICAgICkge1xyXG4gICAgICByZXR1cm4gRm9ybS5mb3JtQ29udGV4dC5kYXRhLnByb2Nlc3MucmVtb3ZlT25Qcm9jZXNzU3RhdHVzQ2hhbmdlKGhhbmRsZXIpO1xyXG4gICAgfVxyXG4gICAgLyoqXHJcbiAgICAgKiBVc2UgdGhpcyB0byByZW1vdmUgYSBmdW5jdGlvbiBhcyBhbiBldmVudCBoYW5kbGVyIGZvciB0aGUgT25TdGFnZUNoYW5nZSBldmVudC5cclxuICAgICAqIEBwYXJhbSBoYW5kbGVyIElmIGFuIGFub255bW91cyBmdW5jdGlvbiBpcyBzZXQgdXNpbmcgdGhlIGFkZE9uU3RhZ2VDaGFuZ2UgbWV0aG9kIGl0XHJcbiAgICAgKiAgICAgICAgICAgICAgICBjYW5ub3QgYmUgcmVtb3ZlZCB1c2luZyB0aGlzIG1ldGhvZC5cclxuICAgICAqL1xyXG4gICAgc3RhdGljIHJlbW92ZU9uU3RhZ2VDaGFuZ2UoaGFuZGxlcjogWHJtLkV2ZW50cy5TdGFnZUNoYW5nZUV2ZW50SGFuZGxlcikge1xyXG4gICAgICByZXR1cm4gRm9ybS5mb3JtQ29udGV4dC5kYXRhLnByb2Nlc3MucmVtb3ZlT25TdGFnZUNoYW5nZShoYW5kbGVyKTtcclxuICAgIH1cclxuICAgIC8qKlxyXG4gICAgICogVXNlIHRoaXMgdG8gcmVtb3ZlIGEgZnVuY3Rpb24gYXMgYW4gZXZlbnQgaGFuZGxlciBmb3IgdGhlIE9uU3RhZ2VDaGFuZ2UgZXZlbnQuXHJcbiAgICAgKiBAcGFyYW0gaGFuZGxlciBJZiBhbiBhbm9ueW1vdXMgZnVuY3Rpb24gaXMgc2V0IHVzaW5nIHRoZSBhZGRPblN0YWdlQ2hhbmdlIG1ldGhvZCBpdFxyXG4gICAgICogICAgICAgICAgICAgICAgY2Fubm90IGJlIHJlbW92ZWQgdXNpbmcgdGhpcyBtZXRob2QuXHJcbiAgICAgKi9cclxuICAgIHN0YXRpYyByZW1vdmVPblN0YWdlU2VsZWN0ZWQoaGFuZGxlcjogWHJtLkV2ZW50cy5Db250ZXh0U2Vuc2l0aXZlSGFuZGxlcikge1xyXG4gICAgICByZXR1cm4gRm9ybS5mb3JtQ29udGV4dC5kYXRhLnByb2Nlc3MucmVtb3ZlT25TdGFnZVNlbGVjdGVkKGhhbmRsZXIpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogVXNlIHRoaXMgbWV0aG9kIHRvIGFzeW5jaHJvbm91c2x5IHJldHJpZXZlIHRoZSBlbmFibGVkIGJ1c2luZXNzIHByb2Nlc3MgZmxvd3MgdGhhdCB0aGUgdXNlciBjYW4gc3dpdGNoIHRvIGZvciBhbiBlbnRpdHkuXHJcbiAgICAgKiBAcmV0dXJucyByZXR1cm5zIGNhbGxiYWNrIHJlc3BvbnNlIGFzIFByb21pc2VcclxuICAgICAqL1xyXG4gICAgc3RhdGljIGdldEVuYWJsZWRQcm9jZXNzZXMoKSB7XHJcbiAgICAgIHJldHVybiBhc1Byb21pc2U8WHJtLlByb2Nlc3NGbG93LlByb2Nlc3NEaWN0aW9uYXJ5PihcclxuICAgICAgICBGb3JtLmZvcm1Db250ZXh0LmRhdGEucHJvY2Vzcy5nZXRFbmFibGVkUHJvY2Vzc2VzLFxyXG4gICAgICAgIEZvcm0uZm9ybUNvbnRleHQuZGF0YS5wcm9jZXNzXHJcbiAgICAgICk7XHJcbiAgICB9XHJcbiAgICAvKipcclxuICAgICAqIFJldHVybnMgYWxsIHByb2Nlc3MgaW5zdGFuY2VzIGZvciB0aGUgZW50aXR5IHJlY29yZCB0aGF0IHRoZSBjYWxsaW5nIHVzZXIgaGFzIGFjY2VzcyB0by5cclxuICAgICAqIEByZXR1cm5zIHJldHVybnMgY2FsbGJhY2sgcmVzcG9uc2UgYXMgUHJvbWlzZVxyXG4gICAgICovXHJcbiAgICBzdGF0aWMgZ2V0UHJvY2Vzc0luc3RhbmNlcygpIHtcclxuICAgICAgcmV0dXJuIGFzUHJvbWlzZTxYcm0uUHJvY2Vzc0Zsb3cuR2V0UHJvY2Vzc0luc3RhbmNlc0RlbGVnYXRlPihcclxuICAgICAgICBGb3JtLmZvcm1Db250ZXh0LmRhdGEucHJvY2Vzcy5nZXRQcm9jZXNzSW5zdGFuY2VzLFxyXG4gICAgICAgIEZvcm0uZm9ybUNvbnRleHQuZGF0YS5wcm9jZXNzXHJcbiAgICAgICk7XHJcbiAgICB9XHJcbiAgICAvKipcclxuICAgICAqIFByb2dyZXNzZXMgdG8gdGhlIG5leHQgc3RhZ2UuXHJcbiAgICAgKiBAcmV0dXJucyByZXR1cm5zIGNhbGxiYWNrIHJlc3BvbnNlIGFzIFByb21pc2VcclxuICAgICAqL1xyXG4gICAgc3RhdGljIG1vdmVOZXh0KCkge1xyXG4gICAgICByZXR1cm4gYXNQcm9taXNlPFhybS5Qcm9jZXNzRmxvdy5Qcm9jZXNzQ2FsbGJhY2tEZWxlZ2F0ZT4oXHJcbiAgICAgICAgRm9ybS5mb3JtQ29udGV4dC5kYXRhLnByb2Nlc3MubW92ZU5leHQsXHJcbiAgICAgICAgRm9ybS5mb3JtQ29udGV4dC5kYXRhLnByb2Nlc3NcclxuICAgICAgKTtcclxuICAgIH1cclxuICAgIC8qKlxyXG4gICAgICogTW92ZXMgdG8gdGhlIHByZXZpb3VzIHN0YWdlLlxyXG4gICAgICogQHJldHVybnMgcmV0dXJucyBjYWxsYmFjayByZXNwb25zZSBhcyBQcm9taXNlXHJcbiAgICAgKi9cclxuICAgIHN0YXRpYyBtb3ZlUHJldmlvdXMoKSB7XHJcbiAgICAgIHJldHVybiBhc1Byb21pc2U8WHJtLlByb2Nlc3NGbG93LlByb2Nlc3NDYWxsYmFja0RlbGVnYXRlPihcclxuICAgICAgICBGb3JtLmZvcm1Db250ZXh0LmRhdGEucHJvY2Vzcy5tb3ZlUHJldmlvdXMsXHJcbiAgICAgICAgRm9ybS5mb3JtQ29udGV4dC5kYXRhLnByb2Nlc3NcclxuICAgICAgKTtcclxuICAgIH1cclxuICAgIC8qKlxyXG4gICAgICogU2V0IGEgUHJvY2VzcyBhcyB0aGUgYWN0aXZlIHByb2Nlc3MuXHJcbiAgICAgKiBAcGFyYW0gcHJvY2Vzc0lkIFRoZSBJZCBvZiB0aGUgcHJvY2VzcyB0byBtYWtlIHRoZSBhY3RpdmUgcHJvY2Vzcy5cclxuICAgICAqIEByZXR1cm5zIHJldHVybnMgY2FsbGJhY2sgcmVzcG9uc2UgYXMgUHJvbWlzZVxyXG4gICAgICovXHJcbiAgICBzdGF0aWMgc2V0QWN0aXZlUHJvY2Vzcyhwcm9jZXNzSWQ6IHN0cmluZykge1xyXG4gICAgICByZXR1cm4gYXNQcm9taXNlPFhybS5Qcm9jZXNzRmxvdy5Qcm9jZXNzQ2FsbGJhY2tEZWxlZ2F0ZT4oXHJcbiAgICAgICAgRm9ybS5mb3JtQ29udGV4dC5kYXRhLnByb2Nlc3Muc2V0QWN0aXZlUHJvY2VzcyxcclxuICAgICAgICBGb3JtLmZvcm1Db250ZXh0LmRhdGEucHJvY2VzcyxcclxuICAgICAgICBwcm9jZXNzSWRcclxuICAgICAgKTtcclxuICAgIH1cclxuICAgIC8qKlxyXG4gICAgICogU2V0cyBhIHByb2Nlc3MgaW5zdGFuY2UgYXMgdGhlIGFjdGl2ZSBpbnN0YW5jZVxyXG4gICAgICogQHBhcmFtIHByb2Nlc3NJbnN0YW5jZUlkIFRoZSBJZCBvZiB0aGUgcHJvY2VzcyBpbnN0YW5jZSB0byBtYWtlIHRoZSBhY3RpdmUgaW5zdGFuY2UuXHJcbiAgICAgKiBAcmV0dXJucyByZXR1cm5zIGNhbGxiYWNrIHJlc3BvbnNlIGFzIFByb21pc2VcclxuICAgICAqL1xyXG4gICAgc3RhdGljIHNldEFjdGl2ZVByb2Nlc3NJbnN0YW5jZShwcm9jZXNzSW5zdGFuY2VJZDogc3RyaW5nKSB7XHJcbiAgICAgIHJldHVybiBhc1Byb21pc2U8WHJtLlByb2Nlc3NGbG93LlNldFByb2Nlc3NJbnN0YW5jZURlbGVnYXRlPihcclxuICAgICAgICBGb3JtLmZvcm1Db250ZXh0LmRhdGEucHJvY2Vzcy5zZXRBY3RpdmVQcm9jZXNzSW5zdGFuY2UsXHJcbiAgICAgICAgRm9ybS5mb3JtQ29udGV4dC5kYXRhLnByb2Nlc3MsXHJcbiAgICAgICAgcHJvY2Vzc0luc3RhbmNlSWRcclxuICAgICAgKTtcclxuICAgIH1cclxuICAgIC8qKlxyXG4gICAgICogU2V0IGEgc3RhZ2UgYXMgdGhlIGFjdGl2ZSBzdGFnZS5cclxuICAgICAqIEBwYXJhbSBzdGFnZUlkIHRoZSBJZCBvZiB0aGUgc3RhZ2UgdG8gbWFrZSB0aGUgYWN0aXZlIHN0YWdlLlxyXG4gICAgICogQHJldHVybnMgcmV0dXJucyBjYWxsYmFjayByZXNwb25zZSBhcyBQcm9taXNlXHJcbiAgICAgKi9cclxuICAgIHN0YXRpYyBzZXRBY3RpdmVTdGFnZShzdGFnZUlkOiBzdHJpbmcpIHtcclxuICAgICAgcmV0dXJuIGFzUHJvbWlzZTxYcm0uUHJvY2Vzc0Zsb3cuU2V0UHJvY2Vzc0luc3RhbmNlRGVsZWdhdGU+KFxyXG4gICAgICAgIEZvcm0uZm9ybUNvbnRleHQuZGF0YS5wcm9jZXNzLnNldEFjdGl2ZVN0YWdlLFxyXG4gICAgICAgIEZvcm0uZm9ybUNvbnRleHQuZGF0YS5wcm9jZXNzLFxyXG4gICAgICAgIHN0YWdlSWRcclxuICAgICAgKTtcclxuICAgIH1cclxuICAgIC8qKlxyXG4gICAgICogVXNlIHRoaXMgbWV0aG9kIHRvIHNldCB0aGUgY3VycmVudCBzdGF0dXMgb2YgdGhlIHByb2Nlc3MgaW5zdGFuY2VcclxuICAgICAqIEBwYXJhbSBzdGF0dXMgVGhlIG5ldyBzdGF0dXMgZm9yIHRoZSBwcm9jZXNzXHJcbiAgICAgKiBAcmV0dXJucyByZXR1cm5zIGNhbGxiYWNrIHJlc3BvbnNlIGFzIFByb21pc2VcclxuICAgICAqL1xyXG4gICAgc3RhdGljIHNldFN0YXR1cyhzdGF0dXM6IFhybS5Qcm9jZXNzRmxvdy5Qcm9jZXNzU3RhdHVzKSB7XHJcbiAgICAgIHJldHVybiBhc1Byb21pc2U8WHJtLlByb2Nlc3NGbG93LlNldFByb2Nlc3NJbnN0YW5jZURlbGVnYXRlPihcclxuICAgICAgICBGb3JtLmZvcm1Db250ZXh0LmRhdGEucHJvY2Vzcy5zZXRTdGF0dXMsXHJcbiAgICAgICAgRm9ybS5mb3JtQ29udGV4dC5kYXRhLnByb2Nlc3MsXHJcbiAgICAgICAgc3RhdHVzXHJcbiAgICAgICk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBleHBvcnQgY2xhc3MgRmllbGRzIHtcclxuICAgIC8qKlxyXG4gICAgICogQWRkcyBhIGhhbmRsZXIgb3IgYW4gYXJyYXkgb2YgaGFuZGxlcnMgdG8gYmUgY2FsbGVkIHdoZW4gdGhlIGF0dHJpYnV0ZSdzIHZhbHVlIGlzIGNoYW5nZWQuXHJcbiAgICAgKiBAcGFyYW0gZmllbGRzIEFuIGFycmF5IG9mIGZpZWxkcyB0byBvbiB3aGljaCB0aGlzIG1ldGhvZCBzaG91bGQgYmUgYXBwbGllZC5cclxuICAgICAqIEBwYXJhbSBoYW5kbGVycyBUaGUgZnVuY3Rpb24gcmVmZXJlbmNlIG9yIGFuIGFycmF5IG9mIGZ1bmN0aW9uIHJlZmVyZW5jZXMuXHJcbiAgICAgKi9cclxuICAgIHN0YXRpYyBhZGRPbkNoYW5nZShcclxuICAgICAgZmllbGRzOiBDbGFzcy5GaWVsZFtdLFxyXG4gICAgICBoYW5kbGVyOiBYcm0uRXZlbnRzLkF0dHJpYnV0ZS5DaGFuZ2VFdmVudEhhbmRsZXJcclxuICAgICk6IHZvaWQge1xyXG4gICAgICBmaWVsZHMuZm9yRWFjaCgoZmllbGQpID0+IHtcclxuICAgICAgICBmaWVsZC5hZGRPbkNoYW5nZShoYW5kbGVyKTtcclxuICAgICAgfSk7XHJcbiAgICB9XHJcbiAgICAvKipcclxuICAgICAqIEZpcmUgYWxsIFwib24gY2hhbmdlXCIgZXZlbnQgaGFuZGxlcnMuXHJcbiAgICAgKiBAcGFyYW0gZmllbGRzIEFuIGFycmF5IG9mIGZpZWxkcyB0byBvbiB3aGljaCB0aGlzIG1ldGhvZCBzaG91bGQgYmUgYXBwbGllZC5cclxuICAgICAqL1xyXG4gICAgc3RhdGljIGZpcmVPbkNoYW5nZShmaWVsZHM6IENsYXNzLkZpZWxkW10pOiB2b2lkIHtcclxuICAgICAgZmllbGRzLmZvckVhY2goKGZpZWxkKSA9PiB7XHJcbiAgICAgICAgZmllbGQuZmlyZU9uQ2hhbmdlKCk7XHJcbiAgICAgIH0pO1xyXG4gICAgfVxyXG4gICAgLyoqXHJcbiAgICAgKiBSZW1vdmVzIHRoZSBoYW5kbGVyIGZyb20gdGhlIFwib24gY2hhbmdlXCIgZXZlbnQuXHJcbiAgICAgKiBAcGFyYW0gZmllbGRzIEFuIGFycmF5IG9mIGZpZWxkcyB0byBvbiB3aGljaCB0aGlzIG1ldGhvZCBzaG91bGQgYmUgYXBwbGllZC5cclxuICAgICAqIEBwYXJhbSBoYW5kbGVyIFRoZSBoYW5kbGVyLlxyXG4gICAgICovXHJcbiAgICBzdGF0aWMgcmVtb3ZlT25DaGFuZ2UoXHJcbiAgICAgIGZpZWxkczogQ2xhc3MuRmllbGRbXSxcclxuICAgICAgaGFuZGxlcjogWHJtLkV2ZW50cy5BdHRyaWJ1dGUuQ2hhbmdlRXZlbnRIYW5kbGVyXHJcbiAgICApOiB2b2lkIHtcclxuICAgICAgZmllbGRzLmZvckVhY2goKGZpZWxkKSA9PiB7XHJcbiAgICAgICAgZmllbGQucmVtb3ZlT25DaGFuZ2UoaGFuZGxlcik7XHJcbiAgICAgIH0pO1xyXG4gICAgfVxyXG4gICAgLyoqXHJcbiAgICAgKiBTZXRzIHRoZSByZXF1aXJlZCBsZXZlbC5cclxuICAgICAqIEBwYXJhbSBmaWVsZHMgQW4gYXJyYXkgb2YgZmllbGRzIHRvIG9uIHdoaWNoIHRoaXMgbWV0aG9kIHNob3VsZCBiZSBhcHBsaWVkLlxyXG4gICAgICogQHBhcmFtIHJlcXVpcmVtZW50TGV2ZWwgVGhlIHJlcXVpcmVtZW50IGxldmVsLCBhcyBlaXRoZXIgXCJub25lXCIsIFwicmVxdWlyZWRcIiwgb3IgXCJyZWNvbW1lbmRlZFwiXHJcbiAgICAgKi9cclxuICAgIHN0YXRpYyBzZXRSZXF1aXJlZExldmVsKFxyXG4gICAgICBmaWVsZHM6IENsYXNzLkZpZWxkW10sXHJcbiAgICAgIHJlcXVpcmVtZW50TGV2ZWw6IFhybS5BdHRyaWJ1dGVzLlJlcXVpcmVtZW50TGV2ZWxcclxuICAgICk6IHZvaWQge1xyXG4gICAgICBmaWVsZHMuZm9yRWFjaCgoZmllbGQpID0+IHtcclxuICAgICAgICBmaWVsZC5zZXRSZXF1aXJlZExldmVsKHJlcXVpcmVtZW50TGV2ZWwpO1xyXG4gICAgICB9KTtcclxuICAgIH1cclxuICAgIC8qKlxyXG4gICAgICogU2V0cyB0aGUgc3VibWl0IG1vZGUuXHJcbiAgICAgKiBAcGFyYW0gZmllbGRzIEFuIGFycmF5IG9mIGZpZWxkcyB0byBvbiB3aGljaCB0aGlzIG1ldGhvZCBzaG91bGQgYmUgYXBwbGllZC5cclxuICAgICAqIEBwYXJhbSBzdWJtaXRNb2RlIFRoZSBzdWJtaXQgbW9kZSwgYXMgZWl0aGVyIFwiYWx3YXlzXCIsIFwibmV2ZXJcIiwgb3IgXCJkaXJ0eVwiLlxyXG4gICAgICogQGRlZmF1bHQgc3VibWl0TW9kZSBcImRpcnR5XCJcclxuICAgICAqIEBzZWUge0BsaW5rIFhybUVudW0uQXR0cmlidXRlUmVxdWlyZW1lbnRMZXZlbH1cclxuICAgICAqL1xyXG4gICAgc3RhdGljIHNldFN1Ym1pdE1vZGUoXHJcbiAgICAgIGZpZWxkczogQ2xhc3MuRmllbGRbXSxcclxuICAgICAgc3VibWl0TW9kZTogWHJtLlN1Ym1pdE1vZGVcclxuICAgICk6IHZvaWQge1xyXG4gICAgICBmaWVsZHMuZm9yRWFjaCgoZmllbGQpID0+IHtcclxuICAgICAgICBmaWVsZC5zZXRTdWJtaXRNb2RlKHN1Ym1pdE1vZGUpO1xyXG4gICAgICB9KTtcclxuICAgIH1cclxuICAgIC8qKlxyXG4gICAgICogU2V0cyB0aGUgdmFsdWUuXHJcbiAgICAgKiBAcGFyYW0gZmllbGRzIEFuIGFycmF5IG9mIGZpZWxkcyB0byBvbiB3aGljaCB0aGlzIG1ldGhvZCBzaG91bGQgYmUgYXBwbGllZC5cclxuICAgICAqIEBwYXJhbSB2YWx1ZSBUaGUgdmFsdWUuXHJcbiAgICAgKiBAcmVtYXJrcyBBdHRyaWJ1dGVzIG9uIFF1aWNrIENyZWF0ZSBGb3JtcyB3aWxsIG5vdCBzYXZlIHZhbHVlcyBzZXQgd2l0aCB0aGlzIG1ldGhvZC5cclxuICAgICAqL1xyXG4gICAgc3RhdGljIHNldFZhbHVlKGZpZWxkczogQ2xhc3MuRmllbGRbXSwgdmFsdWU6IGFueSk6IHZvaWQge1xyXG4gICAgICBmaWVsZHMuZm9yRWFjaCgoZmllbGQpID0+IHtcclxuICAgICAgICBmaWVsZC5zZXRWYWx1ZSh2YWx1ZSk7XHJcbiAgICAgIH0pO1xyXG4gICAgfVxyXG4gICAgLyoqXHJcbiAgICAgKiBTZXRzIGEgdmFsdWUgZm9yIGEgY29sdW1uIHRvIGRldGVybWluZSB3aGV0aGVyIGl0IGlzIHZhbGlkIG9yIGludmFsaWQgd2l0aCBhIG1lc3NhZ2VcclxuICAgICAqIEBwYXJhbSBmaWVsZHMgQW4gYXJyYXkgb2YgZmllbGRzIHRvIG9uIHdoaWNoIHRoaXMgbWV0aG9kIHNob3VsZCBiZSBhcHBsaWVkLlxyXG4gICAgICogQHBhcmFtIGlzVmFsaWQgU3BlY2lmeSBmYWxzZSB0byBzZXQgdGhlIGNvbHVtbiB2YWx1ZSB0byBpbnZhbGlkIGFuZCB0cnVlIHRvIHNldCB0aGUgdmFsdWUgdG8gdmFsaWQuXHJcbiAgICAgKiBAcGFyYW0gbWVzc2FnZSBUaGUgbWVzc2FnZSB0byBkaXNwbGF5LlxyXG4gICAgICogQHNlZSB7QGxpbmsgaHR0cHM6Ly9sZWFybi5taWNyb3NvZnQuY29tL2VuLXVzL3Bvd2VyLWFwcHMvZGV2ZWxvcGVyL21vZGVsLWRyaXZlbi1hcHBzL2NsaWVudGFwaS9yZWZlcmVuY2UvYXR0cmlidXRlcy9zZXRpc3ZhbGlkIEV4dGVybmFsIExpbms6IHNldElzVmFsaWQgKENsaWVudCBBUEkgcmVmZXJlbmNlKX1cclxuICAgICAqL1xyXG4gICAgc3RhdGljIHNldElzVmFsaWQoXHJcbiAgICAgIGZpZWxkczogQ2xhc3MuRmllbGRbXSxcclxuICAgICAgaXNWYWxpZDogYm9vbGVhbixcclxuICAgICAgbWVzc2FnZT86IHN0cmluZ1xyXG4gICAgKTogdm9pZCB7XHJcbiAgICAgIGZpZWxkcy5mb3JFYWNoKChmaWVsZCkgPT4ge1xyXG4gICAgICAgIGZpZWxkLnNldElzVmFsaWQoaXNWYWxpZCwgbWVzc2FnZSk7XHJcbiAgICAgIH0pO1xyXG4gICAgfVxyXG4gICAgLyoqXHJcbiAgICAgKiBTZXRzIHRoZSByZXF1aXJlZCBsZXZlbC5cclxuICAgICAqIEBwYXJhbSBmaWVsZHMgQW4gYXJyYXkgb2YgZmllbGRzIHRvIG9uIHdoaWNoIHRoaXMgbWV0aG9kIHNob3VsZCBiZSBhcHBsaWVkLlxyXG4gICAgICogQHBhcmFtIHJlcXVpcmVkIFRoZSByZXF1aXJlbWVudCBsZXZlbCwgYXMgZWl0aGVyIGZhbHNlIGZvciBcIm5vbmVcIiBvciB0cnVlIGZvciBcInJlcXVpcmVkXCJcclxuICAgICAqL1xyXG4gICAgc3RhdGljIHNldFJlcXVpcmVkKGZpZWxkczogQ2xhc3MuRmllbGRbXSwgcmVxdWlyZWQ6IGJvb2xlYW4pOiB2b2lkIHtcclxuICAgICAgZmllbGRzLmZvckVhY2goKGZpZWxkKSA9PiB7XHJcbiAgICAgICAgZmllbGQuc2V0UmVxdWlyZWQocmVxdWlyZWQpO1xyXG4gICAgICB9KTtcclxuICAgIH1cclxuICAgIC8qKlxyXG4gICAgICogU2V0cyB0aGUgc3RhdGUgb2YgdGhlIGNvbnRyb2wgdG8gZWl0aGVyIGVuYWJsZWQsIG9yIGRpc2FibGVkLlxyXG4gICAgICogQHBhcmFtIGZpZWxkcyBBbiBhcnJheSBvZiBmaWVsZHMgdG8gb24gd2hpY2ggdGhpcyBtZXRob2Qgc2hvdWxkIGJlIGFwcGxpZWQuXHJcbiAgICAgKiBAcGFyYW0gZGlzYWJsZWQgdHJ1ZSB0byBkaXNhYmxlLCBmYWxzZSB0byBlbmFibGUuXHJcbiAgICAgKi9cclxuICAgIHN0YXRpYyBzZXREaXNhYmxlZChmaWVsZHM6IENsYXNzLkZpZWxkW10sIGRpc2FibGVkOiBib29sZWFuKTogdm9pZCB7XHJcbiAgICAgIGZpZWxkcy5mb3JFYWNoKChmaWVsZCkgPT4ge1xyXG4gICAgICAgIGZpZWxkLnNldERpc2FibGVkKGRpc2FibGVkKTtcclxuICAgICAgfSk7XHJcbiAgICB9XHJcbiAgICAvKipcclxuICAgICAqIFNldHMgdGhlIHZpc2liaWxpdHkgc3RhdGUuXHJcbiAgICAgKiBAcGFyYW0gZmllbGRzIEFuIGFycmF5IG9mIGZpZWxkcyB0byBvbiB3aGljaCB0aGlzIG1ldGhvZCBzaG91bGQgYmUgYXBwbGllZC5cclxuICAgICAqIEBwYXJhbSB2aXNpYmxlIHRydWUgdG8gc2hvdywgZmFsc2UgdG8gaGlkZS5cclxuICAgICAqL1xyXG4gICAgc3RhdGljIHNldFZpc2libGUoZmllbGRzOiBDbGFzcy5GaWVsZFtdLCB2aXNpYmxlOiBib29sZWFuKTogdm9pZCB7XHJcbiAgICAgIGZpZWxkcy5mb3JFYWNoKChmaWVsZCkgPT4ge1xyXG4gICAgICAgIGZpZWxkLnNldFZpc2libGUodmlzaWJsZSk7XHJcbiAgICAgIH0pO1xyXG4gICAgfVxyXG4gICAgLyoqXHJcbiAgICAgKiBTZXRzIGEgY29udHJvbC1sb2NhbCBub3RpZmljYXRpb24gbWVzc2FnZS5cclxuICAgICAqIEBwYXJhbSBmaWVsZHMgQW4gYXJyYXkgb2YgZmllbGRzIHRvIG9uIHdoaWNoIHRoaXMgbWV0aG9kIHNob3VsZCBiZSBhcHBsaWVkLlxyXG4gICAgICogQHBhcmFtIG1lc3NhZ2UgVGhlIG1lc3NhZ2UuXHJcbiAgICAgKiBAcGFyYW0gdW5pcXVlSWQgVW5pcXVlIGlkZW50aWZpZXIuXHJcbiAgICAgKiBAcmV0dXJucyB0cnVlIGlmIGl0IHN1Y2NlZWRzLCBmYWxzZSBpZiBpdCBmYWlscy5cclxuICAgICAqIEByZW1hcmtzICAgICBXaGVuIHRoaXMgbWV0aG9kIGlzIHVzZWQgb24gTWljcm9zb2Z0IER5bmFtaWNzIENSTSBmb3IgdGFibGV0cyBhIHJlZCBcIlhcIiBpY29uXHJcbiAgICAgKiAgICAgICAgICAgICAgYXBwZWFycyBuZXh0IHRvIHRoZSBjb250cm9sLiBUYXBwaW5nIG9uIHRoZSBpY29uIHdpbGwgZGlzcGxheSB0aGUgbWVzc2FnZS5cclxuICAgICAqL1xyXG4gICAgc3RhdGljIHNldE5vdGlmaWNhdGlvbihcclxuICAgICAgZmllbGRzOiBDbGFzcy5GaWVsZFtdLFxyXG4gICAgICBtZXNzYWdlOiBzdHJpbmcsXHJcbiAgICAgIHVuaXF1ZUlkOiBzdHJpbmdcclxuICAgICk6IHZvaWQge1xyXG4gICAgICBmaWVsZHMuZm9yRWFjaCgoZmllbGQpID0+IHtcclxuICAgICAgICBmaWVsZC5zZXROb3RpZmljYXRpb24obWVzc2FnZSwgdW5pcXVlSWQpO1xyXG4gICAgICB9KTtcclxuICAgIH1cclxuICAgIC8qKlxyXG4gICAgICogRGlzcGxheXMgYW4gZXJyb3Igb3IgcmVjb21tZW5kYXRpb24gbm90aWZpY2F0aW9uIGZvciBhIGNvbnRyb2wsIGFuZCBsZXRzIHlvdSBzcGVjaWZ5IGFjdGlvbnMgdG8gZXhlY3V0ZSBiYXNlZCBvbiB0aGUgbm90aWZpY2F0aW9uLlxyXG4gICAgICogQHBhcmFtIGZpZWxkcyBBbiBhcnJheSBvZiBmaWVsZHMgdG8gb24gd2hpY2ggdGhpcyBtZXRob2Qgc2hvdWxkIGJlIGFwcGxpZWQuXHJcbiAgICAgKi9cclxuICAgIHN0YXRpYyBhZGROb3RpZmljYXRpb24oXHJcbiAgICAgIGZpZWxkczogQ2xhc3MuRmllbGRbXSxcclxuICAgICAgbWVzc2FnZTogc3RyaW5nLFxyXG4gICAgICBub3RpZmljYXRpb25MZXZlbDogXCJFUlJPUlwiIHwgXCJSRUNPTU1FTkRBVElPTlwiLFxyXG4gICAgICB1bmlxdWVJZDogc3RyaW5nLFxyXG4gICAgICBhY3Rpb25zPzogWHJtLkNvbnRyb2xzLkNvbnRyb2xOb3RpZmljYXRpb25BY3Rpb25bXVxyXG4gICAgKTogdm9pZCB7XHJcbiAgICAgIGZpZWxkcy5mb3JFYWNoKChmaWVsZCkgPT4ge1xyXG4gICAgICAgIGZpZWxkLmFkZE5vdGlmaWNhdGlvbihtZXNzYWdlLCBub3RpZmljYXRpb25MZXZlbCwgdW5pcXVlSWQsIGFjdGlvbnMpO1xyXG4gICAgICB9KTtcclxuICAgIH1cclxuICAgIC8qKlxyXG4gICAgICogQ2xlYXJzIHRoZSBub3RpZmljYXRpb24gaWRlbnRpZmllZCBieSB1bmlxdWVJZC5cclxuICAgICAqIEBwYXJhbSBmaWVsZHMgQW4gYXJyYXkgb2YgZmllbGRzIHRvIG9uIHdoaWNoIHRoaXMgbWV0aG9kIHNob3VsZCBiZSBhcHBsaWVkLlxyXG4gICAgICogQHBhcmFtIHVuaXF1ZUlkIChPcHRpb25hbCkgVW5pcXVlIGlkZW50aWZpZXIuXHJcbiAgICAgKiBAcmV0dXJucyB0cnVlIGlmIGl0IHN1Y2NlZWRzLCBmYWxzZSBpZiBpdCBmYWlscy5cclxuICAgICAqIEByZW1hcmtzIElmIHRoZSB1bmlxdWVJZCBwYXJhbWV0ZXIgaXMgbm90IHVzZWQsIHRoZSBjdXJyZW50IG5vdGlmaWNhdGlvbiBzaG93biB3aWxsIGJlIHJlbW92ZWQuXHJcbiAgICAgKi9cclxuICAgIHN0YXRpYyByZW1vdmVOb3RpZmljYXRpb24oZmllbGRzOiBDbGFzcy5GaWVsZFtdLCB1bmlxdWVJZDogc3RyaW5nKTogdm9pZCB7XHJcbiAgICAgIGZpZWxkcy5mb3JFYWNoKChmaWVsZCkgPT4ge1xyXG4gICAgICAgIGZpZWxkLnJlbW92ZU5vdGlmaWNhdGlvbih1bmlxdWVJZCk7XHJcbiAgICAgIH0pO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogUmVwcmVzZW50cyBhIGZvcm0gaW4gRHluYW1pY3MgMzY1LlxyXG4gICAqL1xyXG4gIGV4cG9ydCBjbGFzcyBGb3JtIHtcclxuICAgIHByb3RlY3RlZCBzdGF0aWMgX2Zvcm1Db250ZXh0OiBYcm0uRm9ybUNvbnRleHQ7XHJcbiAgICBwcm90ZWN0ZWQgc3RhdGljIF9leGVjdXRpb25Db250ZXh0OiBYcm0uRXZlbnRzLkV2ZW50Q29udGV4dDtcclxuICAgIGNvbnN0cnVjdG9yKCkge31cclxuICAgIC8qKkdldHMgYSByZWZlcmVuY2UgdG8gdGhlIGN1cnJlbnQgZm9ybSBjb250ZXh0Ki9cclxuICAgIHN0YXRpYyBnZXQgZm9ybUNvbnRleHQoKTogWHJtLkZvcm1Db250ZXh0IHtcclxuICAgICAgcmV0dXJuIHRoaXMuX2Zvcm1Db250ZXh0O1xyXG4gICAgfVxyXG4gICAgLyoqR2V0cyBhIHJlZmVyZW5jZSB0byB0aGUgY3VycmVudCBleGVjdXRpbyBjb250ZXh0Ki9cclxuICAgIHN0YXRpYyBnZXQgZXhlY3V0aW9uQ29udGV4dCgpOiBYcm0uRXZlbnRzLkV2ZW50Q29udGV4dCB7XHJcbiAgICAgIHJldHVybiB0aGlzLl9leGVjdXRpb25Db250ZXh0O1xyXG4gICAgfVxyXG4gICAgLyoqR2V0cyBhIGxvb2t1cCB2YWx1ZSB0aGF0IHJlZmVyZW5jZXMgdGhlIHJlY29yZC4qL1xyXG4gICAgc3RhdGljIGdldCBlbnRpdHlSZWZlcmVuY2UoKSB7XHJcbiAgICAgIHJldHVybiBGb3JtLmZvcm1Db250ZXh0LmRhdGEuZW50aXR5LmdldEVudGl0eVJlZmVyZW5jZSgpO1xyXG4gICAgfVxyXG4gICAgLyoqU2V0cyBhIHJlZmVyZW5jZSB0byB0aGUgY3VycmVudCBmb3JtIGNvbnRleHQqL1xyXG4gICAgc3RhdGljIHNldCBmb3JtQ29udGV4dChjb250ZXh0OiBYcm0uRm9ybUNvbnRleHQgfCBYcm0uRXZlbnRzLkV2ZW50Q29udGV4dCkge1xyXG4gICAgICBpZiAoIWNvbnRleHQpXHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxyXG4gICAgICAgICAgYFhybUV4LkZvcm0uc2V0Rm9ybUNvbnRleHQ6IFRoZSBleGVjdXRpb25Db250ZXh0IG9yIGZvcm1Db250ZXh0IHdhcyBub3QgcGFzc2VkIHRvIHRoZSBmdW5jdGlvbi5gXHJcbiAgICAgICAgKTtcclxuICAgICAgaWYgKFwiZ2V0Rm9ybUNvbnRleHRcIiBpbiBjb250ZXh0KSB7XHJcbiAgICAgICAgdGhpcy5fZXhlY3V0aW9uQ29udGV4dCA9IGNvbnRleHQ7XHJcbiAgICAgICAgdGhpcy5fZm9ybUNvbnRleHQgPSBjb250ZXh0LmdldEZvcm1Db250ZXh0KCk7XHJcbiAgICAgIH0gZWxzZSBpZiAoXCJkYXRhXCIgaW4gY29udGV4dCkgdGhpcy5fZm9ybUNvbnRleHQgPSBjb250ZXh0O1xyXG4gICAgICBlbHNlXHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxyXG4gICAgICAgICAgYFhybUV4LkZvcm0uc2V0Rm9ybUNvbnRleHQ6IFRoZSBwYXNzZWQgY29udGV4dCBpcyBub3QgYW4gZXhlY3V0aW9uQ29udGV4dCBvciBmb3JtQ29udGV4dC5gXHJcbiAgICAgICAgKTtcclxuICAgIH1cclxuICAgIC8qKlNldHMgYSByZWZlcmVuY2UgdG8gdGhlIGN1cnJlbnQgZXhlY3V0aW9uIGNvbnRleHQqL1xyXG4gICAgc3RhdGljIHNldCBleGVjdXRpb25Db250ZXh0KFxyXG4gICAgICBjb250ZXh0OiBYcm0uRm9ybUNvbnRleHQgfCBYcm0uRXZlbnRzLkV2ZW50Q29udGV4dFxyXG4gICAgKSB7XHJcbiAgICAgIGlmICghY29udGV4dClcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXHJcbiAgICAgICAgICBgWHJtRXguRm9ybS5zZXRFeGVjdXRpb25Db250ZXh0OiBUaGUgZXhlY3V0aW9uQ29udGV4dCBvciBmb3JtQ29udGV4dCB3YXMgbm90IHBhc3NlZCB0byB0aGUgZnVuY3Rpb24uYFxyXG4gICAgICAgICk7XHJcbiAgICAgIGlmIChcImdldEZvcm1Db250ZXh0XCIgaW4gY29udGV4dCkge1xyXG4gICAgICAgIHRoaXMuX2V4ZWN1dGlvbkNvbnRleHQgPSBjb250ZXh0O1xyXG4gICAgICAgIHRoaXMuX2Zvcm1Db250ZXh0ID0gY29udGV4dC5nZXRGb3JtQ29udGV4dCgpO1xyXG4gICAgICB9IGVsc2UgaWYgKFwiZGF0YVwiIGluIGNvbnRleHQpIHRoaXMuX2Zvcm1Db250ZXh0ID0gY29udGV4dDtcclxuICAgICAgZWxzZVxyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcclxuICAgICAgICAgIGBYcm1FeC5Gb3JtLnNldEV4ZWN1dGlvbkNvbnRleHQ6IFRoZSBwYXNzZWQgY29udGV4dCBpcyBub3QgYW4gZXhlY3V0aW9uQ29udGV4dCBvciBmb3JtQ29udGV4dC5gXHJcbiAgICAgICAgKTtcclxuICAgIH1cclxuICAgIC8qKlJldHVybnMgdHJ1ZSBpZiBmb3JtIGlzIGZyb20gdHlwZSBjcmVhdGUqL1xyXG4gICAgc3RhdGljIGdldCBJc0NyZWF0ZSgpIHtcclxuICAgICAgcmV0dXJuIEZvcm0uZm9ybUNvbnRleHQudWkuZ2V0Rm9ybVR5cGUoKSA9PSAxO1xyXG4gICAgfVxyXG4gICAgLyoqUmV0dXJucyB0cnVlIGlmIGZvcm0gaXMgZnJvbSB0eXBlIHVwZGF0ZSovXHJcbiAgICBzdGF0aWMgZ2V0IElzVXBkYXRlKCkge1xyXG4gICAgICByZXR1cm4gRm9ybS5mb3JtQ29udGV4dC51aS5nZXRGb3JtVHlwZSgpID09IDI7XHJcbiAgICB9XHJcbiAgICAvKipSZXR1cm5zIHRydWUgaWYgZm9ybSBpcyBub3QgZnJvbSB0eXBlIGNyZWF0ZSovXHJcbiAgICBzdGF0aWMgZ2V0IElzTm90Q3JlYXRlKCkge1xyXG4gICAgICByZXR1cm4gRm9ybS5mb3JtQ29udGV4dC51aS5nZXRGb3JtVHlwZSgpICE9IDE7XHJcbiAgICB9XHJcbiAgICAvKipSZXR1cm5zIHRydWUgaWYgZm9ybSBpcyBub3QgZnJvbSB0eXBlIHVwZGF0ZSovXHJcbiAgICBzdGF0aWMgZ2V0IElzTm90VXBkYXRlKCkge1xyXG4gICAgICByZXR1cm4gRm9ybS5mb3JtQ29udGV4dC51aS5nZXRGb3JtVHlwZSgpICE9IDI7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBEaXNwbGF5cyBhIGZvcm0gbGV2ZWwgbm90aWZpY2F0aW9uLiBBbnkgbnVtYmVyIG9mIG5vdGlmaWNhdGlvbnMgY2FuIGJlIGRpc3BsYXllZCBhbmQgd2lsbCByZW1haW4gdW50aWwgcmVtb3ZlZCB1c2luZyBjbGVhckZvcm1Ob3RpZmljYXRpb24uXHJcbiAgICAgKiBUaGUgaGVpZ2h0IG9mIHRoZSBub3RpZmljYXRpb24gYXJlYSBpcyBsaW1pdGVkIHNvIGVhY2ggbmV3IG1lc3NhZ2Ugd2lsbCBiZSBhZGRlZCB0byB0aGUgdG9wLlxyXG4gICAgICogQHBhcmFtIG1lc3NhZ2UgVGhlIHRleHQgb2YgdGhlIG5vdGlmaWNhdGlvbiBtZXNzYWdlLlxyXG4gICAgICogQHBhcmFtIGxldmVsIFRoZSBsZXZlbCBvZiB0aGUgbm90aWZpY2F0aW9uIHdoaWNoIGRlZmluZXMgaG93IHRoZSBtZXNzYWdlIHdpbGwgYmUgZGlzcGxheWVkLCBzdWNoIGFzIHRoZSBpY29uLlxyXG4gICAgICogRVJST1I6IE5vdGlmaWNhdGlvbiB3aWxsIHVzZSB0aGUgc3lzdGVtIGVycm9yIGljb24uXHJcbiAgICAgKiBXQVJOSU5HOiBOb3RpZmljYXRpb24gd2lsbCB1c2UgdGhlIHN5c3RlbSB3YXJuaW5nIGljb24uXHJcbiAgICAgKiBJTkZPOiBOb3RpZmljYXRpb24gd2lsbCB1c2UgdGhlIHN5c3RlbSBpbmZvIGljb24uXHJcbiAgICAgKiBAcGFyYW0gdW5pcXVlSWQgVW5pcXVlIGlkZW50aWZpZXIgZm9yIHRoZSBub3RpZmljYXRpb24gd2hpY2ggaXMgdXNlZCB3aXRoIGNsZWFyRm9ybU5vdGlmaWNhdGlvbiB0byByZW1vdmUgdGhlIG5vdGlmaWNhdGlvbi5cclxuICAgICAqIEByZXR1cm5zIHRydWUgaWYgaXQgc3VjY2VlZHMsIG90aGVucHJ3aXNlIGZhbHNlLlxyXG4gICAgICovXHJcbiAgICBzdGF0aWMgYWRkRm9ybU5vdGlmaWNhdGlvbihcclxuICAgICAgbWVzc2FnZTogc3RyaW5nLFxyXG4gICAgICBsZXZlbDogWHJtLkZvcm1Ob3RpZmljYXRpb25MZXZlbCxcclxuICAgICAgdW5pcXVlSWQ6IHN0cmluZ1xyXG4gICAgKSB7XHJcbiAgICAgIHRyeSB7XHJcbiAgICAgICAgcmV0dXJuIEZvcm0uZm9ybUNvbnRleHQudWkuc2V0Rm9ybU5vdGlmaWNhdGlvbihcclxuICAgICAgICAgIG1lc3NhZ2UsXHJcbiAgICAgICAgICBsZXZlbCxcclxuICAgICAgICAgIHVuaXF1ZUlkXHJcbiAgICAgICAgKTtcclxuICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgWHJtRXguJHtYcm1FeC5nZXRGdW5jdGlvbk5hbWUoKX06XFxuJHtlcnJvci5tZXNzYWdlfWApO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgICAvKipcclxuICAgICAqIENsZWFycyB0aGUgZm9ybSBub3RpZmljYXRpb24gZGVzY3JpYmVkIGJ5IHVuaXF1ZUlkLlxyXG4gICAgICogQHBhcmFtIHVuaXF1ZUlkIFVuaXF1ZSBpZGVudGlmaWVyLlxyXG4gICAgICogQHJldHVybnMgVHJ1ZSBpZiBpdCBzdWNjZWVkcywgb3RoZXJ3aXNlIGZhbHNlLlxyXG4gICAgICovXHJcbiAgICBzdGF0aWMgcmVtb3ZlRm9ybU5vdGlmaWNhdGlvbih1bmlxdWVJZDogc3RyaW5nKSB7XHJcbiAgICAgIHRyeSB7XHJcbiAgICAgICAgcmV0dXJuIEZvcm0uZm9ybUNvbnRleHQudWkuY2xlYXJGb3JtTm90aWZpY2F0aW9uKHVuaXF1ZUlkKTtcclxuICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgWHJtRXguJHtYcm1FeC5nZXRGdW5jdGlvbk5hbWUoKX06XFxuJHtlcnJvci5tZXNzYWdlfWApO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgICAvKipcclxuICAgICAqIEFkZHMgYSBoYW5kbGVyIHRvIGJlIGNhbGxlZCB3aGVuIHRoZSByZWNvcmQgaXMgc2F2ZWQuXHJcbiAgICAgKi9cclxuICAgIHN0YXRpYyBhZGRPblNhdmUoXHJcbiAgICAgIGhhbmRsZXJzOlxyXG4gICAgICAgIHwgWHJtLkV2ZW50cy5Db250ZXh0U2Vuc2l0aXZlSGFuZGxlclxyXG4gICAgICAgIHwgWHJtLkV2ZW50cy5Db250ZXh0U2Vuc2l0aXZlSGFuZGxlcltdXHJcbiAgICApIHtcclxuICAgICAgdHJ5IHtcclxuICAgICAgICBpZiAoIUFycmF5LmlzQXJyYXkoaGFuZGxlcnMpKSB7XHJcbiAgICAgICAgICBoYW5kbGVycyA9IFtoYW5kbGVyc107XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGhhbmRsZXJzLmZvckVhY2goKGhhbmRsZXIpID0+IHtcclxuICAgICAgICAgIGlmICh0eXBlb2YgaGFuZGxlciAhPT0gXCJmdW5jdGlvblwiKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgJyR7aGFuZGxlcn0nIGlzIG5vdCBhIGZ1bmN0aW9uYCk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICBGb3JtLmZvcm1Db250ZXh0LmRhdGEuZW50aXR5LnJlbW92ZU9uU2F2ZShoYW5kbGVyKTtcclxuICAgICAgICAgIEZvcm0uZm9ybUNvbnRleHQuZGF0YS5lbnRpdHkuYWRkT25TYXZlKGhhbmRsZXIpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBYcm1FeC4ke1hybUV4LmdldEZ1bmN0aW9uTmFtZSgpfTpcXG4ke2Vycm9yLm1lc3NhZ2V9YCk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICAgIC8qKlxyXG4gICAgICogQWRkcyBhIGZ1bmN0aW9uIHRvIGJlIGNhbGxlZCBhZnRlciB0aGUgT25TYXZlIGlzIGNvbXBsZXRlLlxyXG4gICAgICogQHBhcmFtIGhhbmRsZXIgVGhlIGhhbmRsZXIuXHJcbiAgICAgKiBAcmVtYXJrcyBBZGRlZCBpbiA5LjJcclxuICAgICAqIEBzZWUge0BsaW5rIGh0dHBzOi8vZG9jcy5taWNyb3NvZnQuY29tL2VuLXVzL3Bvd2VyYXBwcy9kZXZlbG9wZXIvbW9kZWwtZHJpdmVuLWFwcHMvY2xpZW50YXBpL3JlZmVyZW5jZS9ldmVudHMvcG9zdHNhdmUgRXh0ZXJuYWwgTGluazogUG9zdFNhdmUgRXZlbnQgRG9jdW1lbnRhdGlvbn1cclxuICAgICAqL1xyXG4gICAgc3RhdGljIGFkZE9uUG9zdFNhdmUoXHJcbiAgICAgIGhhbmRsZXJzOlxyXG4gICAgICAgIHwgWHJtLkV2ZW50cy5Db250ZXh0U2Vuc2l0aXZlSGFuZGxlclxyXG4gICAgICAgIHwgWHJtLkV2ZW50cy5Db250ZXh0U2Vuc2l0aXZlSGFuZGxlcltdXHJcbiAgICApIHtcclxuICAgICAgdHJ5IHtcclxuICAgICAgICBpZiAoIUFycmF5LmlzQXJyYXkoaGFuZGxlcnMpKSB7XHJcbiAgICAgICAgICBoYW5kbGVycyA9IFtoYW5kbGVyc107XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGhhbmRsZXJzLmZvckVhY2goKGhhbmRsZXIpID0+IHtcclxuICAgICAgICAgIGlmICh0eXBlb2YgaGFuZGxlciAhPT0gXCJmdW5jdGlvblwiKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgJyR7aGFuZGxlcn0nIGlzIG5vdCBhIGZ1bmN0aW9uYCk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICBGb3JtLmZvcm1Db250ZXh0LmRhdGEuZW50aXR5LnJlbW92ZU9uUG9zdFNhdmUoaGFuZGxlcik7XHJcbiAgICAgICAgICBGb3JtLmZvcm1Db250ZXh0LmRhdGEuZW50aXR5LmFkZE9uUG9zdFNhdmUoaGFuZGxlcik7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFhybUV4LiR7WHJtRXguZ2V0RnVuY3Rpb25OYW1lKCl9OlxcbiR7ZXJyb3IubWVzc2FnZX1gKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgLyoqXHJcbiAgICAgKiBBZGRzIGEgZnVuY3Rpb24gdG8gYmUgY2FsbGVkIHdoZW4gZm9ybSBkYXRhIGlzIGxvYWRlZC5cclxuICAgICAqIEBwYXJhbSBoYW5kbGVyIFRoZSBmdW5jdGlvbiB0byBiZSBleGVjdXRlZCB3aGVuIHRoZSBmb3JtIGRhdGEgbG9hZHMuIFRoZSBmdW5jdGlvbiB3aWxsIGJlIGFkZGVkIHRvIHRoZSBib3R0b20gb2YgdGhlIGV2ZW50IGhhbmRsZXIgcGlwZWxpbmUuXHJcbiAgICAgKi9cclxuICAgIHN0YXRpYyBhZGRPbkxvYWQoXHJcbiAgICAgIGhhbmRsZXJzOlxyXG4gICAgICAgIHwgWHJtLkV2ZW50cy5Db250ZXh0U2Vuc2l0aXZlSGFuZGxlclxyXG4gICAgICAgIHwgWHJtLkV2ZW50cy5Db250ZXh0U2Vuc2l0aXZlSGFuZGxlcltdXHJcbiAgICApIHtcclxuICAgICAgdHJ5IHtcclxuICAgICAgICBpZiAoIUFycmF5LmlzQXJyYXkoaGFuZGxlcnMpKSB7XHJcbiAgICAgICAgICBoYW5kbGVycyA9IFtoYW5kbGVyc107XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGhhbmRsZXJzLmZvckVhY2goKGhhbmRsZXIpID0+IHtcclxuICAgICAgICAgIGlmICh0eXBlb2YgaGFuZGxlciAhPT0gXCJmdW5jdGlvblwiKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgJyR7aGFuZGxlcn0nIGlzIG5vdCBhIGZ1bmN0aW9uYCk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICBGb3JtLmZvcm1Db250ZXh0LmRhdGEucmVtb3ZlT25Mb2FkKGhhbmRsZXIpO1xyXG4gICAgICAgICAgRm9ybS5mb3JtQ29udGV4dC5kYXRhLmFkZE9uTG9hZChoYW5kbGVyKTtcclxuICAgICAgICB9KTtcclxuICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgWHJtRXguJHtYcm1FeC5nZXRGdW5jdGlvbk5hbWUoKX06XFxuJHtlcnJvci5tZXNzYWdlfWApO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgICAvKipcclxuICAgICAqIEFkZHMgYSBoYW5kbGVyIHRvIGJlIGNhbGxlZCB3aGVuIHRoZSBhdHRyaWJ1dGUncyB2YWx1ZSBpcyBjaGFuZ2VkLlxyXG4gICAgICogQHBhcmFtIGhhbmRsZXIgVGhlIGZ1bmN0aW9uIHJlZmVyZW5jZS5cclxuICAgICAqL1xyXG4gICAgc3RhdGljIGFkZE9uQ2hhbmdlKFxyXG4gICAgICBmaWVsZHM6IENsYXNzLkZpZWxkW10sXHJcbiAgICAgIGhhbmRsZXJzOlxyXG4gICAgICAgIHwgWHJtLkV2ZW50cy5Db250ZXh0U2Vuc2l0aXZlSGFuZGxlclxyXG4gICAgICAgIHwgWHJtLkV2ZW50cy5Db250ZXh0U2Vuc2l0aXZlSGFuZGxlcltdLFxyXG4gICAgICBleGVjdXRlPzogYm9vbGVhblxyXG4gICAgKSB7XHJcbiAgICAgIHRyeSB7XHJcbiAgICAgICAgaWYgKCFBcnJheS5pc0FycmF5KGhhbmRsZXJzKSkge1xyXG4gICAgICAgICAgaGFuZGxlcnMgPSBbaGFuZGxlcnNdO1xyXG4gICAgICAgIH1cclxuICAgICAgICBoYW5kbGVycy5mb3JFYWNoKChoYW5kbGVyKSA9PiB7XHJcbiAgICAgICAgICBpZiAodHlwZW9mIGhhbmRsZXIgIT09IFwiZnVuY3Rpb25cIikge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYCcke2hhbmRsZXJ9JyBpcyBub3QgYSBmdW5jdGlvbmApO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgZmllbGRzLmZvckVhY2goKGZpZWxkKSA9PiB7XHJcbiAgICAgICAgICAgIGZpZWxkLnJlbW92ZU9uQ2hhbmdlKGhhbmRsZXIpO1xyXG4gICAgICAgICAgICBmaWVsZC5hZGRPbkNoYW5nZShoYW5kbGVyKTtcclxuICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIGlmIChleGVjdXRlKSB7XHJcbiAgICAgICAgICBmaWVsZHMuZm9yRWFjaCgoZmllbGQpID0+IHtcclxuICAgICAgICAgICAgZmllbGQuQXR0cmlidXRlLmZpcmVPbkNoYW5nZSgpO1xyXG4gICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBYcm1FeC4ke1hybUV4LmdldEZ1bmN0aW9uTmFtZSgpfTpcXG4ke2Vycm9yLm1lc3NhZ2V9YCk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9XHJcblxyXG4gIGV4cG9ydCBuYW1lc3BhY2UgQ2xhc3Mge1xyXG4gICAgLyoqXHJcbiAgICAgKiBVc2VkIHRvIGV4ZWN1dGUgbWV0aG9kcyByZWxhdGVkIHRvIGEgc2luZ2xlIEF0dHJpYnV0ZVxyXG4gICAgICovXHJcbiAgICBleHBvcnQgY2xhc3MgRmllbGQgaW1wbGVtZW50cyBYcm0uQXR0cmlidXRlcy5BdHRyaWJ1dGUge1xyXG4gICAgICBwdWJsaWMgc3RhdGljIGFsbEZpZWxkczogRmllbGRbXSA9IFtdO1xyXG5cclxuICAgICAgcHVibGljIHJlYWRvbmx5IE5hbWUhOiBzdHJpbmc7XHJcbiAgICAgIHByb3RlY3RlZCBfYXR0cmlidXRlPzogWHJtLkF0dHJpYnV0ZXMuQXR0cmlidXRlO1xyXG5cclxuICAgICAgY29uc3RydWN0b3IoYXR0cmlidXRlTmFtZTogc3RyaW5nKSB7XHJcbiAgICAgICAgY29uc3QgZXhpc3RpbmdGaWVsZCA9IEZpZWxkLmFsbEZpZWxkcy5maW5kKFxyXG4gICAgICAgICAgKGYpID0+IGYuTmFtZSA9PT0gYXR0cmlidXRlTmFtZVxyXG4gICAgICAgICk7XHJcbiAgICAgICAgaWYgKGV4aXN0aW5nRmllbGQpIHtcclxuICAgICAgICAgIHJldHVybiBleGlzdGluZ0ZpZWxkO1xyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLk5hbWUgPSBhdHRyaWJ1dGVOYW1lO1xyXG4gICAgICAgIEZpZWxkLmFsbEZpZWxkcy5wdXNoKHRoaXMpO1xyXG4gICAgICB9XHJcbiAgICAgIHNldFZhbHVlKHZhbHVlOiBhbnkpOiB2b2lkIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5BdHRyaWJ1dGUuc2V0VmFsdWUodmFsdWUpO1xyXG4gICAgICB9XHJcbiAgICAgIGdldEF0dHJpYnV0ZVR5cGUoKTogWHJtLkF0dHJpYnV0ZXMuQXR0cmlidXRlVHlwZSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuQXR0cmlidXRlLmdldEF0dHJpYnV0ZVR5cGUoKTtcclxuICAgICAgfVxyXG4gICAgICBnZXRGb3JtYXQoKTogWHJtLkF0dHJpYnV0ZXMuQXR0cmlidXRlRm9ybWF0IHtcclxuICAgICAgICByZXR1cm4gdGhpcy5BdHRyaWJ1dGUuZ2V0Rm9ybWF0KCk7XHJcbiAgICAgIH1cclxuICAgICAgZ2V0SXNEaXJ0eSgpOiBib29sZWFuIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5BdHRyaWJ1dGUuZ2V0SXNEaXJ0eSgpO1xyXG4gICAgICB9XHJcbiAgICAgIGdldE5hbWUoKTogc3RyaW5nIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5BdHRyaWJ1dGUuZ2V0TmFtZSgpO1xyXG4gICAgICB9XHJcbiAgICAgIGdldFBhcmVudCgpOiBYcm0uRW50aXR5IHtcclxuICAgICAgICByZXR1cm4gdGhpcy5BdHRyaWJ1dGUuZ2V0UGFyZW50KCk7XHJcbiAgICAgIH1cclxuICAgICAgZ2V0UmVxdWlyZWRMZXZlbCgpOiBYcm0uQXR0cmlidXRlcy5SZXF1aXJlbWVudExldmVsIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5BdHRyaWJ1dGUuZ2V0UmVxdWlyZWRMZXZlbCgpO1xyXG4gICAgICB9XHJcbiAgICAgIGdldFN1Ym1pdE1vZGUoKTogWHJtLlN1Ym1pdE1vZGUge1xyXG4gICAgICAgIHJldHVybiB0aGlzLkF0dHJpYnV0ZS5nZXRTdWJtaXRNb2RlKCk7XHJcbiAgICAgIH1cclxuICAgICAgZ2V0VXNlclByaXZpbGVnZSgpOiBYcm0uUHJpdmlsZWdlIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5BdHRyaWJ1dGUuZ2V0VXNlclByaXZpbGVnZSgpO1xyXG4gICAgICB9XHJcbiAgICAgIHJlbW92ZU9uQ2hhbmdlKGhhbmRsZXI6IFhybS5FdmVudHMuQXR0cmlidXRlLkNoYW5nZUV2ZW50SGFuZGxlcik6IHZvaWQge1xyXG4gICAgICAgIHJldHVybiB0aGlzLkF0dHJpYnV0ZS5yZW1vdmVPbkNoYW5nZShoYW5kbGVyKTtcclxuICAgICAgfVxyXG4gICAgICBzZXRTdWJtaXRNb2RlKHN1Ym1pdE1vZGU6IFhybS5TdWJtaXRNb2RlKTogdm9pZCB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuQXR0cmlidXRlLnNldFN1Ym1pdE1vZGUoc3VibWl0TW9kZSk7XHJcbiAgICAgIH1cclxuICAgICAgZ2V0VmFsdWUoKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuQXR0cmlidXRlLmdldFZhbHVlKCk7XHJcbiAgICAgIH1cclxuICAgICAgc2V0SXNWYWxpZChpc1ZhbGlkOiBib29sZWFuLCBtZXNzYWdlPzogc3RyaW5nKTogdm9pZCB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuQXR0cmlidXRlLnNldElzVmFsaWQoaXNWYWxpZCwgbWVzc2FnZSk7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIHB1YmxpYyBnZXQgQXR0cmlidXRlKCk6IFhybS5BdHRyaWJ1dGVzLkF0dHJpYnV0ZSB7XHJcbiAgICAgICAgcmV0dXJuICh0aGlzLl9hdHRyaWJ1dGUgPz89XHJcbiAgICAgICAgICBGb3JtLmZvcm1Db250ZXh0LmdldEF0dHJpYnV0ZSh0aGlzLk5hbWUpID8/XHJcbiAgICAgICAgICBYcm1FeC50aHJvd0Vycm9yKFxyXG4gICAgICAgICAgICBgVGhlIGF0dHJpYnV0ZSAnJHt0aGlzLk5hbWV9JyB3YXMgbm90IGZvdW5kIG9uIHRoZSBmb3JtLmBcclxuICAgICAgICAgICkpO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBwdWJsaWMgZ2V0IGNvbnRyb2xzKCk6IFhybS5Db2xsZWN0aW9uLkl0ZW1Db2xsZWN0aW9uPFhybS5Db250cm9scy5TdGFuZGFyZENvbnRyb2w+IHtcclxuICAgICAgICByZXR1cm4gdGhpcy5BdHRyaWJ1dGUuY29udHJvbHM7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIC8qKlxyXG4gICAgICAgKiBHZXRzIHRoZSB2YWx1ZS5cclxuICAgICAgICogQHJldHVybnMgVGhlIHZhbHVlLlxyXG4gICAgICAgKi9cclxuICAgICAgcHVibGljIGdldCBWYWx1ZSgpOiBhbnkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLkF0dHJpYnV0ZS5nZXRWYWx1ZSgpO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBwdWJsaWMgc2V0IFZhbHVlKHZhbHVlOiBhbnkpIHtcclxuICAgICAgICB0aGlzLkF0dHJpYnV0ZS5zZXRWYWx1ZSh2YWx1ZSk7XHJcbiAgICAgIH1cclxuICAgICAgLyoqXHJcbiAgICAgICAqIFNldHMgYSBjb250cm9sLWxvY2FsIG5vdGlmaWNhdGlvbiBtZXNzYWdlLlxyXG4gICAgICAgKiBAcGFyYW0gbWVzc2FnZSBUaGUgbWVzc2FnZS5cclxuICAgICAgICogQHBhcmFtIHVuaXF1ZUlkIFVuaXF1ZSBpZGVudGlmaWVyLlxyXG4gICAgICAgKiBAcmV0dXJucyB0cnVlIGlmIGl0IHN1Y2NlZWRzLCBmYWxzZSBpZiBpdCBmYWlscy5cclxuICAgICAgICogQHJlbWFya3MgICAgIFdoZW4gdGhpcyBtZXRob2QgaXMgdXNlZCBvbiBNaWNyb3NvZnQgRHluYW1pY3MgQ1JNIGZvciB0YWJsZXRzIGEgcmVkIFwiWFwiIGljb25cclxuICAgICAgICogICAgICAgICAgICAgIGFwcGVhcnMgbmV4dCB0byB0aGUgY29udHJvbC4gVGFwcGluZyBvbiB0aGUgaWNvbiB3aWxsIGRpc3BsYXkgdGhlIG1lc3NhZ2UuXHJcbiAgICAgICAqL1xyXG4gICAgICBwdWJsaWMgc2V0Tm90aWZpY2F0aW9uKG1lc3NhZ2U6IHN0cmluZywgdW5pcXVlSWQ6IHN0cmluZyk6IHRoaXMge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICBpZiAoIW1lc3NhZ2UpIHRocm93IG5ldyBFcnJvcihgbm8gbWVzc2FnZSB3YXMgcHJvdmlkZWQuYCk7XHJcbiAgICAgICAgICBpZiAoIXVuaXF1ZUlkKSB0aHJvdyBuZXcgRXJyb3IoYG5vIHVuaXF1ZUlkIHdhcyBwcm92aWRlZC5gKTtcclxuICAgICAgICAgIHRoaXMuY29udHJvbHMuZm9yRWFjaCgoY29udHJvbCkgPT5cclxuICAgICAgICAgICAgY29udHJvbC5zZXROb3RpZmljYXRpb24obWVzc2FnZSwgdW5pcXVlSWQpXHJcbiAgICAgICAgICApO1xyXG4gICAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xyXG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxyXG4gICAgICAgICAgICBgWHJtRXguJHtYcm1FeC5nZXRGdW5jdGlvbk5hbWUoKX06XFxuJHtlcnJvci5tZXNzYWdlfWBcclxuICAgICAgICAgICk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcblxyXG4gICAgICAvKipcclxuICAgICAgICogU2V0cyB0aGUgdmlzaWJpbGl0eSBzdGF0ZS5cclxuICAgICAgICogQHBhcmFtIHZpc2libGUgdHJ1ZSB0byBzaG93LCBmYWxzZSB0byBoaWRlLlxyXG4gICAgICAgKi9cclxuICAgICAgcHVibGljIHNldFZpc2libGUodmlzaWJsZTogYm9vbGVhbik6IHRoaXMge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICB0aGlzLmNvbnRyb2xzLmZvckVhY2goKGNvbnRyb2wpID0+IGNvbnRyb2wuc2V0VmlzaWJsZSh2aXNpYmxlKSk7XHJcbiAgICAgICAgICByZXR1cm4gdGhpcztcclxuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XHJcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXHJcbiAgICAgICAgICAgIGBYcm1FeC4ke1hybUV4LmdldEZ1bmN0aW9uTmFtZSgpfTpcXG4ke2Vycm9yLm1lc3NhZ2V9YFxyXG4gICAgICAgICAgKTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIC8qKlxyXG4gICAgICAgKiBTZXRzIHRoZSBzdGF0ZSBvZiB0aGUgY29udHJvbCB0byBlaXRoZXIgZW5hYmxlZCwgb3IgZGlzYWJsZWQuXHJcbiAgICAgICAqIEBwYXJhbSBkaXNhYmxlZCB0cnVlIHRvIGRpc2FibGUsIGZhbHNlIHRvIGVuYWJsZS5cclxuICAgICAgICovXHJcbiAgICAgIHB1YmxpYyBzZXREaXNhYmxlZChkaXNhYmxlZDogYm9vbGVhbik6IHRoaXMge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICB0aGlzLmNvbnRyb2xzLmZvckVhY2goKGNvbnRyb2wpID0+IGNvbnRyb2wuc2V0RGlzYWJsZWQoZGlzYWJsZWQpKTtcclxuICAgICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcclxuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcclxuICAgICAgICAgICAgYFhybUV4LiR7WHJtRXguZ2V0RnVuY3Rpb25OYW1lKCl9OlxcbiR7ZXJyb3IubWVzc2FnZX1gXHJcbiAgICAgICAgICApO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG5cclxuICAgICAgLyoqXHJcbiAgICAgICAqIFNldHMgdGhlIHJlcXVpcmVkIGxldmVsLlxyXG4gICAgICAgKiBAcGFyYW0gcmVxdWlyZW1lbnRMZXZlbCBUaGUgcmVxdWlyZW1lbnQgbGV2ZWwsIGFzIGVpdGhlciBcIm5vbmVcIiwgXCJyZXF1aXJlZFwiLCBvciBcInJlY29tbWVuZGVkXCJcclxuICAgICAgICovXHJcbiAgICAgIHB1YmxpYyBzZXRSZXF1aXJlZExldmVsKFxyXG4gICAgICAgIHJlcXVpcmVtZW50TGV2ZWw6IFhybS5BdHRyaWJ1dGVzLlJlcXVpcmVtZW50TGV2ZWxcclxuICAgICAgKTogdGhpcyB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgIHRoaXMuQXR0cmlidXRlLnNldFJlcXVpcmVkTGV2ZWwocmVxdWlyZW1lbnRMZXZlbCk7XHJcbiAgICAgICAgICByZXR1cm4gdGhpcztcclxuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XHJcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXHJcbiAgICAgICAgICAgIGBYcm1FeC4ke1hybUV4LmdldEZ1bmN0aW9uTmFtZSgpfTpcXG4ke2Vycm9yLm1lc3NhZ2V9YFxyXG4gICAgICAgICAgKTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIC8qKlxyXG4gICAgICAgKiBTZXRzIHRoZSByZXF1aXJlZCBsZXZlbC5cclxuICAgICAgICogQHBhcmFtIHJlcXVpcmVkIFRoZSByZXF1aXJlbWVudCBsZXZlbCwgYXMgZWl0aGVyIGZhbHNlIGZvciBcIm5vbmVcIiBvciB0cnVlIGZvciBcInJlcXVpcmVkXCJcclxuICAgICAgICovXHJcbiAgICAgIHB1YmxpYyBzZXRSZXF1aXJlZChyZXF1aXJlZDogYm9vbGVhbik6IHRoaXMge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICB0aGlzLkF0dHJpYnV0ZS5zZXRSZXF1aXJlZExldmVsKHJlcXVpcmVkID8gXCJyZXF1aXJlZFwiIDogXCJub25lXCIpO1xyXG4gICAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xyXG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxyXG4gICAgICAgICAgICBgWHJtRXguJHtYcm1FeC5nZXRGdW5jdGlvbk5hbWUoKX06XFxuJHtlcnJvci5tZXNzYWdlfWBcclxuICAgICAgICAgICk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcblxyXG4gICAgICAvKipGaXJlIGFsbCBcIm9uIGNoYW5nZVwiIGV2ZW50IGhhbmRsZXJzLiAqL1xyXG4gICAgICBwdWJsaWMgZmlyZU9uQ2hhbmdlKCk6IHRoaXMge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICB0aGlzLkF0dHJpYnV0ZS5maXJlT25DaGFuZ2UoKTtcclxuICAgICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcclxuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcclxuICAgICAgICAgICAgYFhybUV4LiR7WHJtRXguZ2V0RnVuY3Rpb25OYW1lKCl9OlxcbiR7ZXJyb3IubWVzc2FnZX1gXHJcbiAgICAgICAgICApO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG5cclxuICAgICAgLyoqXHJcbiAgICAgICAqIEFkZHMgYSBoYW5kbGVyIG9yIGFuIGFycmF5IG9mIGhhbmRsZXJzIHRvIGJlIGNhbGxlZCB3aGVuIHRoZSBhdHRyaWJ1dGUncyB2YWx1ZSBpcyBjaGFuZ2VkLlxyXG4gICAgICAgKiBAcGFyYW0gaGFuZGxlcnMgVGhlIGZ1bmN0aW9uIHJlZmVyZW5jZSBvciBhbiBhcnJheSBvZiBmdW5jdGlvbiByZWZlcmVuY2VzLlxyXG4gICAgICAgKi9cclxuICAgICAgcHVibGljIGFkZE9uQ2hhbmdlKFxyXG4gICAgICAgIGhhbmRsZXJzOlxyXG4gICAgICAgICAgfCBYcm0uRXZlbnRzLkNvbnRleHRTZW5zaXRpdmVIYW5kbGVyXHJcbiAgICAgICAgICB8IFhybS5FdmVudHMuQ29udGV4dFNlbnNpdGl2ZUhhbmRsZXJbXVxyXG4gICAgICApOiB0aGlzIHtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkoaGFuZGxlcnMpKSB7XHJcbiAgICAgICAgICAgIGZvciAoY29uc3QgaGFuZGxlciBvZiBoYW5kbGVycykge1xyXG4gICAgICAgICAgICAgIGlmICh0eXBlb2YgaGFuZGxlciAhPT0gXCJmdW5jdGlvblwiKVxyXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGAnJHtoYW5kbGVyfScgaXMgbm90IGEgZnVuY3Rpb25gKTtcclxuICAgICAgICAgICAgICB0aGlzLkF0dHJpYnV0ZS5yZW1vdmVPbkNoYW5nZShoYW5kbGVyKTtcclxuICAgICAgICAgICAgICB0aGlzLkF0dHJpYnV0ZS5hZGRPbkNoYW5nZShoYW5kbGVyKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgaWYgKHR5cGVvZiBoYW5kbGVycyAhPT0gXCJmdW5jdGlvblwiKVxyXG4gICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgJyR7aGFuZGxlcnN9JyBpcyBub3QgYSBmdW5jdGlvbmApO1xyXG4gICAgICAgICAgICB0aGlzLkF0dHJpYnV0ZS5yZW1vdmVPbkNoYW5nZShoYW5kbGVycyk7XHJcbiAgICAgICAgICAgIHRoaXMuQXR0cmlidXRlLmFkZE9uQ2hhbmdlKGhhbmRsZXJzKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcclxuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcclxuICAgICAgICAgICAgYFhybUV4LiR7WHJtRXguZ2V0RnVuY3Rpb25OYW1lKCl9OlxcbiR7ZXJyb3IubWVzc2FnZX1gXHJcbiAgICAgICAgICApO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG5cclxuICAgICAgLyoqXHJcbiAgICAgICAqIERpc3BsYXlzIGFuIGVycm9yIG9yIHJlY29tbWVuZGF0aW9uIG5vdGlmaWNhdGlvbiBmb3IgYSBjb250cm9sLCBhbmQgbGV0cyB5b3Ugc3BlY2lmeSBhY3Rpb25zIHRvIGV4ZWN1dGUgYmFzZWQgb24gdGhlIG5vdGlmaWNhdGlvbi5cclxuICAgICAgICovXHJcbiAgICAgIHB1YmxpYyBhZGROb3RpZmljYXRpb24oXHJcbiAgICAgICAgbWVzc2FnZTogc3RyaW5nLFxyXG4gICAgICAgIG5vdGlmaWNhdGlvbkxldmVsOiBcIkVSUk9SXCIgfCBcIlJFQ09NTUVOREFUSU9OXCIsXHJcbiAgICAgICAgdW5pcXVlSWQ6IHN0cmluZyxcclxuICAgICAgICBhY3Rpb25zPzogWHJtLkNvbnRyb2xzLkNvbnRyb2xOb3RpZmljYXRpb25BY3Rpb25bXVxyXG4gICAgICApOiB0aGlzIHtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgaWYgKCF1bmlxdWVJZCkgdGhyb3cgbmV3IEVycm9yKGBubyB1bmlxdWVJZCB3YXMgcHJvdmlkZWQuYCk7XHJcbiAgICAgICAgICBpZiAoYWN0aW9ucyAmJiAhQXJyYXkuaXNBcnJheShhY3Rpb25zKSlcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxyXG4gICAgICAgICAgICAgIGB0aGUgYWN0aW9uIHBhcmFtZXRlciBpcyBub3QgYW4gYXJyYXkgb2YgQ29udHJvbE5vdGlmaWNhdGlvbkFjdGlvbmBcclxuICAgICAgICAgICAgKTtcclxuICAgICAgICAgIHRoaXMuY29udHJvbHMuZm9yRWFjaCgoY29udHJvbCkgPT4ge1xyXG4gICAgICAgICAgICBjb250cm9sLmFkZE5vdGlmaWNhdGlvbih7XHJcbiAgICAgICAgICAgICAgbWVzc2FnZXM6IFttZXNzYWdlXSxcclxuICAgICAgICAgICAgICBub3RpZmljYXRpb25MZXZlbDogbm90aWZpY2F0aW9uTGV2ZWwsXHJcbiAgICAgICAgICAgICAgdW5pcXVlSWQ6IHVuaXF1ZUlkLFxyXG4gICAgICAgICAgICAgIGFjdGlvbnM6IGFjdGlvbnMsXHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgfSk7XHJcbiAgICAgICAgICByZXR1cm4gdGhpcztcclxuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XHJcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXHJcbiAgICAgICAgICAgIGBYcm1FeC4ke1hybUV4LmdldEZ1bmN0aW9uTmFtZSgpfTpcXG4ke2Vycm9yLm1lc3NhZ2V9YFxyXG4gICAgICAgICAgKTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgICAgLyoqXHJcbiAgICAgICAqIENsZWFycyB0aGUgbm90aWZpY2F0aW9uIGlkZW50aWZpZWQgYnkgdW5pcXVlSWQuXHJcbiAgICAgICAqIEBwYXJhbSB1bmlxdWVJZCAoT3B0aW9uYWwpIFVuaXF1ZSBpZGVudGlmaWVyLlxyXG4gICAgICAgKiBAcmV0dXJucyB0cnVlIGlmIGl0IHN1Y2NlZWRzLCBmYWxzZSBpZiBpdCBmYWlscy5cclxuICAgICAgICogQHJlbWFya3MgSWYgdGhlIHVuaXF1ZUlkIHBhcmFtZXRlciBpcyBub3QgdXNlZCwgdGhlIGN1cnJlbnQgbm90aWZpY2F0aW9uIHNob3duIHdpbGwgYmUgcmVtb3ZlZC5cclxuICAgICAgICovXHJcbiAgICAgIHJlbW92ZU5vdGlmaWNhdGlvbih1bmlxdWVJZDogc3RyaW5nKTogdGhpcyB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgIHRoaXMuY29udHJvbHMuZm9yRWFjaCgoY29udHJvbCkgPT4ge1xyXG4gICAgICAgICAgICBjb250cm9sLmNsZWFyTm90aWZpY2F0aW9uKHVuaXF1ZUlkKTtcclxuICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xyXG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxyXG4gICAgICAgICAgICBgWHJtRXguJHtYcm1FeC5nZXRGdW5jdGlvbk5hbWUoKX06XFxuJHtlcnJvci5tZXNzYWdlfWBcclxuICAgICAgICAgICk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgICBleHBvcnQgY2xhc3MgVGV4dEZpZWxkXHJcbiAgICAgIGV4dGVuZHMgRmllbGRcclxuICAgICAgaW1wbGVtZW50cyBYcm0uQXR0cmlidXRlcy5TdHJpbmdBdHRyaWJ1dGVcclxuICAgIHtcclxuICAgICAgcHJvdGVjdGVkIGRlY2xhcmUgX2F0dHJpYnV0ZTogWHJtLkF0dHJpYnV0ZXMuU3RyaW5nQXR0cmlidXRlO1xyXG4gICAgICBjb25zdHJ1Y3RvcihhdHRyaWJ1dGU6IHN0cmluZykge1xyXG4gICAgICAgIHN1cGVyKGF0dHJpYnV0ZSk7XHJcbiAgICAgIH1cclxuICAgICAgZ2V0TWF4TGVuZ3RoKCk6IG51bWJlciB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuQXR0cmlidXRlLmdldE1heExlbmd0aCgpO1xyXG4gICAgICB9XHJcbiAgICAgIGdldEZvcm1hdCgpOiBYcm0uQXR0cmlidXRlcy5TdHJpbmdBdHRyaWJ1dGVGb3JtYXQge1xyXG4gICAgICAgIHJldHVybiB0aGlzLkF0dHJpYnV0ZS5nZXRGb3JtYXQoKSBhcyBYcm0uQXR0cmlidXRlcy5TdHJpbmdBdHRyaWJ1dGVGb3JtYXQ7XHJcbiAgICAgIH1cclxuICAgICAgZ2V0IEF0dHJpYnV0ZSgpIHtcclxuICAgICAgICByZXR1cm4gKHRoaXMuX2F0dHJpYnV0ZSA/Pz1cclxuICAgICAgICAgIEZvcm0uZm9ybUNvbnRleHQuZ2V0QXR0cmlidXRlKHRoaXMuTmFtZSkgPz9cclxuICAgICAgICAgIFhybUV4LnRocm93RXJyb3IoYEZpZWxkICcke3RoaXMuTmFtZX0nIGRvZXMgbm90IGV4aXN0YCkpO1xyXG4gICAgICB9XHJcbiAgICAgIGdldCBjb250cm9scygpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5BdHRyaWJ1dGUuY29udHJvbHM7XHJcbiAgICAgIH1cclxuICAgICAgZ2V0IFZhbHVlKCk6IHN0cmluZyB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuQXR0cmlidXRlLmdldFZhbHVlKCkgPz8gbnVsbDtcclxuICAgICAgfVxyXG4gICAgICBzZXQgVmFsdWUodmFsdWU6IHN0cmluZykge1xyXG4gICAgICAgIHRoaXMuQXR0cmlidXRlLnNldFZhbHVlKHZhbHVlKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgZXhwb3J0IGNsYXNzIE51bWJlckZpZWxkXHJcbiAgICAgIGV4dGVuZHMgRmllbGRcclxuICAgICAgaW1wbGVtZW50cyBYcm0uQXR0cmlidXRlcy5OdW1iZXJBdHRyaWJ1dGVcclxuICAgIHtcclxuICAgICAgcHJvdGVjdGVkIGRlY2xhcmUgX2F0dHJpYnV0ZTogWHJtLkF0dHJpYnV0ZXMuTnVtYmVyQXR0cmlidXRlO1xyXG4gICAgICBjb25zdHJ1Y3RvcihhdHRyaWJ1dGU6IHN0cmluZykge1xyXG4gICAgICAgIHN1cGVyKGF0dHJpYnV0ZSk7XHJcbiAgICAgIH1cclxuICAgICAgZ2V0Rm9ybWF0KCk6IFhybS5BdHRyaWJ1dGVzLkludGVnZXJBdHRyaWJ1dGVGb3JtYXQge1xyXG4gICAgICAgIHJldHVybiB0aGlzLkF0dHJpYnV0ZS5nZXRGb3JtYXQoKSBhcyBYcm0uQXR0cmlidXRlcy5JbnRlZ2VyQXR0cmlidXRlRm9ybWF0O1xyXG4gICAgICB9XHJcbiAgICAgIGdldE1heCgpOiBudW1iZXIge1xyXG4gICAgICAgIHJldHVybiB0aGlzLkF0dHJpYnV0ZS5nZXRNYXgoKTtcclxuICAgICAgfVxyXG4gICAgICBnZXRNaW4oKTogbnVtYmVyIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5BdHRyaWJ1dGUuZ2V0TWluKCk7XHJcbiAgICAgIH1cclxuICAgICAgZ2V0UHJlY2lzaW9uKCk6IG51bWJlciB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuQXR0cmlidXRlLmdldFByZWNpc2lvbigpO1xyXG4gICAgICB9XHJcbiAgICAgIHNldFByZWNpc2lvbihwcmVjaXNpb246IG51bWJlcik6IHZvaWQge1xyXG4gICAgICAgIHJldHVybiB0aGlzLkF0dHJpYnV0ZS5zZXRQcmVjaXNpb24ocHJlY2lzaW9uKTtcclxuICAgICAgfVxyXG4gICAgICBnZXQgQXR0cmlidXRlKCkge1xyXG4gICAgICAgIHJldHVybiAodGhpcy5fYXR0cmlidXRlID8/PVxyXG4gICAgICAgICAgRm9ybS5mb3JtQ29udGV4dC5nZXRBdHRyaWJ1dGUodGhpcy5OYW1lKSA/P1xyXG4gICAgICAgICAgWHJtRXgudGhyb3dFcnJvcihgRmllbGQgJyR7dGhpcy5OYW1lfScgZG9lcyBub3QgZXhpc3RgKSk7XHJcbiAgICAgIH1cclxuICAgICAgZ2V0IGNvbnRyb2xzKCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLkF0dHJpYnV0ZS5jb250cm9scztcclxuICAgICAgfVxyXG4gICAgICBnZXQgVmFsdWUoKTogbnVtYmVyIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5BdHRyaWJ1dGUuZ2V0VmFsdWUoKSA/PyBudWxsO1xyXG4gICAgICB9XHJcbiAgICAgIHNldCBWYWx1ZSh2YWx1ZTogbnVtYmVyKSB7XHJcbiAgICAgICAgdGhpcy5BdHRyaWJ1dGUuc2V0VmFsdWUodmFsdWUpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgICBleHBvcnQgY2xhc3MgRGF0ZUZpZWxkXHJcbiAgICAgIGV4dGVuZHMgRmllbGRcclxuICAgICAgaW1wbGVtZW50cyBYcm0uQXR0cmlidXRlcy5EYXRlQXR0cmlidXRlXHJcbiAgICB7XHJcbiAgICAgIHByb3RlY3RlZCBkZWNsYXJlIF9hdHRyaWJ1dGU6IFhybS5BdHRyaWJ1dGVzLkRhdGVBdHRyaWJ1dGU7XHJcbiAgICAgIGNvbnN0cnVjdG9yKGF0dHJpYnV0ZTogc3RyaW5nKSB7XHJcbiAgICAgICAgc3VwZXIoYXR0cmlidXRlKTtcclxuICAgICAgfVxyXG4gICAgICBnZXRGb3JtYXQoKTogWHJtLkF0dHJpYnV0ZXMuRGF0ZUF0dHJpYnV0ZUZvcm1hdCB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuQXR0cmlidXRlLmdldEZvcm1hdCgpIGFzIFhybS5BdHRyaWJ1dGVzLkRhdGVBdHRyaWJ1dGVGb3JtYXQ7XHJcbiAgICAgIH1cclxuICAgICAgZ2V0IEF0dHJpYnV0ZSgpIHtcclxuICAgICAgICByZXR1cm4gKHRoaXMuX2F0dHJpYnV0ZSA/Pz1cclxuICAgICAgICAgIEZvcm0uZm9ybUNvbnRleHQuZ2V0QXR0cmlidXRlKHRoaXMuTmFtZSkgPz9cclxuICAgICAgICAgIFhybUV4LnRocm93RXJyb3IoYEZpZWxkICcke3RoaXMuTmFtZX0nIGRvZXMgbm90IGV4aXN0YCkpO1xyXG4gICAgICB9XHJcbiAgICAgIGdldCBjb250cm9scygpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5BdHRyaWJ1dGUuY29udHJvbHM7XHJcbiAgICAgIH1cclxuICAgICAgZ2V0IFZhbHVlKCk6IERhdGUge1xyXG4gICAgICAgIHJldHVybiB0aGlzLkF0dHJpYnV0ZS5nZXRWYWx1ZSgpID8/IG51bGw7XHJcbiAgICAgIH1cclxuICAgICAgc2V0IFZhbHVlKHZhbHVlOiBEYXRlKSB7XHJcbiAgICAgICAgdGhpcy5BdHRyaWJ1dGUuc2V0VmFsdWUodmFsdWUpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgICBleHBvcnQgY2xhc3MgQm9vbGVhbkZpZWxkXHJcbiAgICAgIGV4dGVuZHMgRmllbGRcclxuICAgICAgaW1wbGVtZW50cyBYcm0uQXR0cmlidXRlcy5Cb29sZWFuQXR0cmlidXRlXHJcbiAgICB7XHJcbiAgICAgIHByb3RlY3RlZCBkZWNsYXJlIF9hdHRyaWJ1dGU6IFhybS5BdHRyaWJ1dGVzLkJvb2xlYW5BdHRyaWJ1dGU7XHJcbiAgICAgIGNvbnN0cnVjdG9yKGF0dHJpYnV0ZTogc3RyaW5nKSB7XHJcbiAgICAgICAgc3VwZXIoYXR0cmlidXRlKTtcclxuICAgICAgfVxyXG4gICAgICBnZXRBdHRyaWJ1dGVUeXBlKCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLkF0dHJpYnV0ZS5nZXRBdHRyaWJ1dGVUeXBlKCk7XHJcbiAgICAgIH1cclxuICAgICAgZ2V0SW5pdGlhbFZhbHVlKCk6IGJvb2xlYW4ge1xyXG4gICAgICAgIHJldHVybiB0aGlzLkF0dHJpYnV0ZS5nZXRJbml0aWFsVmFsdWUoKTtcclxuICAgICAgfVxyXG4gICAgICBnZXQgQXR0cmlidXRlKCkge1xyXG4gICAgICAgIHJldHVybiAodGhpcy5fYXR0cmlidXRlID8/PVxyXG4gICAgICAgICAgRm9ybS5mb3JtQ29udGV4dC5nZXRBdHRyaWJ1dGUodGhpcy5OYW1lKSA/P1xyXG4gICAgICAgICAgWHJtRXgudGhyb3dFcnJvcihgRmllbGQgJyR7dGhpcy5OYW1lfScgZG9lcyBub3QgZXhpc3RgKSk7XHJcbiAgICAgIH1cclxuICAgICAgZ2V0IGNvbnRyb2xzKCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLkF0dHJpYnV0ZS5jb250cm9scztcclxuICAgICAgfVxyXG4gICAgICBnZXQgVmFsdWUoKTogYm9vbGVhbiB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuQXR0cmlidXRlLmdldFZhbHVlKCkgPz8gbnVsbDtcclxuICAgICAgfVxyXG4gICAgICBzZXQgVmFsdWUodmFsdWU6IGJvb2xlYW4pIHtcclxuICAgICAgICB0aGlzLkF0dHJpYnV0ZS5zZXRWYWx1ZSh2YWx1ZSk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICAgIGV4cG9ydCBjbGFzcyBNdWx0aVNlbGVjdE9wdGlvblNldEZpZWxkPE9wdGlvbnMgZXh0ZW5kcyBPcHRpb25WYWx1ZXM+XHJcbiAgICAgIGV4dGVuZHMgRmllbGRcclxuICAgICAgaW1wbGVtZW50cyBYcm0uQXR0cmlidXRlcy5NdWx0aVNlbGVjdE9wdGlvblNldEF0dHJpYnV0ZVxyXG4gICAge1xyXG4gICAgICBwcm90ZWN0ZWQgZGVjbGFyZSBfYXR0cmlidXRlOiBYcm0uQXR0cmlidXRlcy5NdWx0aVNlbGVjdE9wdGlvblNldEF0dHJpYnV0ZTtcclxuICAgICAgT3B0aW9uOiBPcHRpb25zO1xyXG4gICAgICBjb25zdHJ1Y3RvcihhdHRyaWJ1dGVOYW1lOiBzdHJpbmcsIG9wdGlvbj86IE9wdGlvbnMpIHtcclxuICAgICAgICBzdXBlcihhdHRyaWJ1dGVOYW1lKTtcclxuICAgICAgICB0aGlzLk9wdGlvbiA9IG9wdGlvbjtcclxuICAgICAgfVxyXG4gICAgICBnZXRGb3JtYXQoKTogWHJtLkF0dHJpYnV0ZXMuT3B0aW9uU2V0QXR0cmlidXRlRm9ybWF0IHtcclxuICAgICAgICByZXR1cm4gdGhpcy5BdHRyaWJ1dGUuZ2V0Rm9ybWF0KCkgYXMgWHJtLkF0dHJpYnV0ZXMuT3B0aW9uU2V0QXR0cmlidXRlRm9ybWF0O1xyXG4gICAgICB9XHJcbiAgICAgIGdldE9wdGlvbih2YWx1ZTogbnVtYmVyIHwgc3RyaW5nKTogWHJtLk9wdGlvblNldFZhbHVlIHtcclxuICAgICAgICBpZiAodHlwZW9mIHZhbHVlID09PSBcIm51bWJlclwiKSB7XHJcbiAgICAgICAgICByZXR1cm4gdGhpcy5BdHRyaWJ1dGUuZ2V0T3B0aW9uKHZhbHVlKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgcmV0dXJuIHRoaXMuQXR0cmlidXRlLmdldE9wdGlvbih2YWx1ZSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICAgIGdldE9wdGlvbnMoKTogWHJtLk9wdGlvblNldFZhbHVlW10ge1xyXG4gICAgICAgIHJldHVybiB0aGlzLkF0dHJpYnV0ZS5nZXRPcHRpb25zKCk7XHJcbiAgICAgIH1cclxuICAgICAgZ2V0U2VsZWN0ZWRPcHRpb24oKTogWHJtLk9wdGlvblNldFZhbHVlW10ge1xyXG4gICAgICAgIHJldHVybiB0aGlzLkF0dHJpYnV0ZS5nZXRTZWxlY3RlZE9wdGlvbigpO1xyXG4gICAgICB9XHJcbiAgICAgIGdldFRleHQoKTogc3RyaW5nW10ge1xyXG4gICAgICAgIHJldHVybiB0aGlzLkF0dHJpYnV0ZS5nZXRUZXh0KCk7XHJcbiAgICAgIH1cclxuICAgICAgZ2V0SW5pdGlhbFZhbHVlKCk6IG51bWJlcltdIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5BdHRyaWJ1dGUuZ2V0SW5pdGlhbFZhbHVlKCk7XHJcbiAgICAgIH1cclxuICAgICAgZ2V0IEF0dHJpYnV0ZSgpIHtcclxuICAgICAgICByZXR1cm4gKHRoaXMuX2F0dHJpYnV0ZSA/Pz1cclxuICAgICAgICAgIEZvcm0uZm9ybUNvbnRleHQuZ2V0QXR0cmlidXRlKHRoaXMuTmFtZSkgPz9cclxuICAgICAgICAgIFhybUV4LnRocm93RXJyb3IoYEZpZWxkICcke3RoaXMuTmFtZX0nIGRvZXMgbm90IGV4aXN0YCkpO1xyXG4gICAgICB9XHJcbiAgICAgIGdldCBjb250cm9scygpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5BdHRyaWJ1dGUuY29udHJvbHM7XHJcbiAgICAgIH1cclxuICAgICAgZ2V0IFZhbHVlKCk6IG51bWJlcltdIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5BdHRyaWJ1dGUuZ2V0VmFsdWUoKTtcclxuICAgICAgfVxyXG4gICAgICBzZXQgVmFsdWUodmFsdWU6IChrZXlvZiBPcHRpb25zKVtdIHwgbnVtYmVyW10pIHtcclxuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHtcclxuICAgICAgICAgIGxldCB2YWx1ZXMgPSBbXTtcclxuICAgICAgICAgIHZhbHVlLmZvckVhY2goKHYpID0+IHtcclxuICAgICAgICAgICAgaWYgKHR5cGVvZiB2ID09IFwibnVtYmVyXCIpIHZhbHVlcy5wdXNoKHYpO1xyXG4gICAgICAgICAgICBlbHNlIHZhbHVlcy5wdXNoKHRoaXMuT3B0aW9uW3ZdKTtcclxuICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgdGhpcy5BdHRyaWJ1dGUuc2V0VmFsdWUodmFsdWVzKTtcclxuICAgICAgICB9IGVsc2UgWHJtRXgudGhyb3dFcnJvcihgRmllbGQgVmFsdWUgJyR7dmFsdWV9JyBpcyBub3QgYW4gQXJyYXlgKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgZXhwb3J0IGNsYXNzIExvb2t1cEZpZWxkXHJcbiAgICAgIGV4dGVuZHMgRmllbGRcclxuICAgICAgaW1wbGVtZW50cyBYcm0uQXR0cmlidXRlcy5Mb29rdXBBdHRyaWJ1dGVcclxuICAgIHtcclxuICAgICAgcHJvdGVjdGVkIGRlY2xhcmUgX2F0dHJpYnV0ZTogWHJtLkF0dHJpYnV0ZXMuTG9va3VwQXR0cmlidXRlO1xyXG4gICAgICBwcm90ZWN0ZWQgX2N1c3RvbUZpbHRlcnM6IGFueSA9IFtdO1xyXG4gICAgICBwcm90ZWN0ZWQgX2lzRW50aXR5QXZhaWxhYmxlT2ZmbGluZTogYm9vbGVhbiB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcclxuICAgICAgY29uc3RydWN0b3IoYXR0cmlidXRlOiBzdHJpbmcpIHtcclxuICAgICAgICBzdXBlcihhdHRyaWJ1dGUpO1xyXG4gICAgICB9XHJcbiAgICAgIGdldElzUGFydHlMaXN0KCk6IGJvb2xlYW4ge1xyXG4gICAgICAgIHJldHVybiB0aGlzLkF0dHJpYnV0ZS5nZXRJc1BhcnR5TGlzdCgpO1xyXG4gICAgICB9XHJcbiAgICAgIGdldCBBdHRyaWJ1dGUoKSB7XHJcbiAgICAgICAgcmV0dXJuICh0aGlzLl9hdHRyaWJ1dGUgPz89XHJcbiAgICAgICAgICBGb3JtLmZvcm1Db250ZXh0LmdldEF0dHJpYnV0ZSh0aGlzLk5hbWUpID8/XHJcbiAgICAgICAgICBYcm1FeC50aHJvd0Vycm9yKGBGaWVsZCAnJHt0aGlzLk5hbWV9JyBkb2VzIG5vdCBleGlzdGApKTtcclxuICAgICAgfVxyXG4gICAgICBnZXQgY29udHJvbHMoKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuQXR0cmlidXRlLmNvbnRyb2xzO1xyXG4gICAgICB9XHJcbiAgICAgIC8qKkdldHMgdGhlIGlkIG9mIHRoZSBmaXJzdCBsb29rdXAgdmFsdWUqL1xyXG4gICAgICBnZXQgSWQoKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuVmFsdWUgJiYgdGhpcy5WYWx1ZS5sZW5ndGggPiAwXHJcbiAgICAgICAgICA/IFhybUV4Lm5vcm1hbGl6ZUd1aWQodGhpcy5WYWx1ZVswXS5pZClcclxuICAgICAgICAgIDogbnVsbDtcclxuICAgICAgfVxyXG4gICAgICAvKipHZXRzIHRoZSBlbnRpdHlUeXBlIG9mIHRoZSBmaXJzdCBsb29rdXAgdmFsdWUqL1xyXG4gICAgICBnZXQgRW50aXR5VHlwZSgpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5WYWx1ZSAmJiB0aGlzLlZhbHVlLmxlbmd0aCA+IDBcclxuICAgICAgICAgID8gdGhpcy5WYWx1ZVswXS5lbnRpdHlUeXBlXHJcbiAgICAgICAgICA6IG51bGw7XHJcbiAgICAgIH1cclxuICAgICAgLyoqR2V0cyB0aGUgZm9ybWF0dGVkIHZhbHVlIG9mIHRoZSBmaXJzdCBsb29rdXAgdmFsdWUqL1xyXG4gICAgICBnZXQgRm9ybWF0dGVkVmFsdWUoKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuVmFsdWUgJiYgdGhpcy5WYWx1ZS5sZW5ndGggPiAwID8gdGhpcy5WYWx1ZVswXS5uYW1lIDogbnVsbDtcclxuICAgICAgfVxyXG4gICAgICBnZXQgVmFsdWUoKTogWHJtLkxvb2t1cFZhbHVlW10ge1xyXG4gICAgICAgIHJldHVybiB0aGlzLkF0dHJpYnV0ZS5nZXRWYWx1ZSgpID8/IG51bGw7XHJcbiAgICAgIH1cclxuICAgICAgc2V0IFZhbHVlKHZhbHVlOiBYcm0uTG9va3VwVmFsdWVbXSkge1xyXG4gICAgICAgIHRoaXMuQXR0cmlidXRlLnNldFZhbHVlKHZhbHVlKTtcclxuICAgICAgfVxyXG4gICAgICAvKipcclxuICAgICAgICogU2V0cyB0aGUgdmFsdWUgb2YgYSBsb29rdXBcclxuICAgICAgICogQHBhcmFtIGlkIEd1aWQgb2YgdGhlIHJlY29yZFxyXG4gICAgICAgKiBAcGFyYW0gZW50aXR5VHlwZSBsb2dpY2FsbmFtZSBvZiB0aGUgZW50aXR5XHJcbiAgICAgICAqIEBwYXJhbSBuYW1lIGZvcm1hdHRlZCB2YWx1ZVxyXG4gICAgICAgKiBAcGFyYW0gYXBwZW5kIGlmIHRydWUsIGFkZHMgdmFsdWUgdG8gdGhlIGFycmF5IGluc3RlYWQgb2YgcmVwbGFjaW5nIGl0XHJcbiAgICAgICAqL1xyXG4gICAgICBzZXRMb29rdXBWYWx1ZShcclxuICAgICAgICBpZDogc3RyaW5nLFxyXG4gICAgICAgIGVudGl0eVR5cGU6IGFueSxcclxuICAgICAgICBuYW1lOiBhbnksXHJcbiAgICAgICAgYXBwZW5kID0gZmFsc2VcclxuICAgICAgKTogdGhpcyB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgIGlmICghaWQpIHRocm93IG5ldyBFcnJvcihgbm8gaWQgcGFyYW1ldGVyIHdhcyBwcm92aWRlZC5gKTtcclxuICAgICAgICAgIGlmICghZW50aXR5VHlwZSlcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBubyBlbnRpdHlUeXBlIHBhcmFtZXRlciB3YXMgcHJvdmlkZWQuYCk7XHJcbiAgICAgICAgICBpZCA9IFhybUV4Lm5vcm1hbGl6ZUd1aWQoaWQpO1xyXG4gICAgICAgICAgY29uc3QgbG9va3VwVmFsdWUgPSB7XHJcbiAgICAgICAgICAgIGlkLFxyXG4gICAgICAgICAgICBlbnRpdHlUeXBlLFxyXG4gICAgICAgICAgICBuYW1lLFxyXG4gICAgICAgICAgfTtcclxuICAgICAgICAgIHRoaXMuVmFsdWUgPVxyXG4gICAgICAgICAgICBhcHBlbmQgJiYgdGhpcy5WYWx1ZVxyXG4gICAgICAgICAgICAgID8gdGhpcy5WYWx1ZS5jb25jYXQobG9va3VwVmFsdWUpXHJcbiAgICAgICAgICAgICAgOiBbbG9va3VwVmFsdWVdO1xyXG4gICAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xyXG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxyXG4gICAgICAgICAgICBgWHJtRXguJHtYcm1FeC5nZXRGdW5jdGlvbk5hbWUoKX06XFxuJHtlcnJvci5tZXNzYWdlfWBcclxuICAgICAgICAgICk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICAgIC8qKlxyXG4gICAgICAgKiBTZXRzIGEgbG9va3VwIHdpdGggYSBsb29rdXAgZnJvbSB0aGUgcmV0cmlldmVkIHJlY29yZC5cclxuICAgICAgICogQHBhcmFtIHNlbGVjdE5hbWVcclxuICAgICAgICogQHBhcmFtIHJldHJpZXZlZFJlY29yZFxyXG4gICAgICAgKiBAZXhhbXBsZVxyXG4gICAgICAgKiB2YXIgY29udGFjdCA9IGF3YWl0IGZpZWxkcy5Db250YWN0LnJldHJpZXZlKCc/JHNlbGVjdD1fcGFyZW50Y3VzdG9tZXJpZF92YWx1ZScpO1xyXG4gICAgICAgKiBmaWVsZHMuQWNjb3VudC5zZXRMb29rdXBGcm9tUmV0cmlldmUoJ19wYXJlbnRjdXN0b21lcmlkX3ZhbHVlJywgY29udGFjdCk7XHJcbiAgICAgICAqIC8vQWx0ZXJuYXRlXHJcbiAgICAgICAqIGZpZWxkcy5BY2NvdW50LnNldExvb2t1cEZyb21SZXRyaWV2ZSgncGFyZW50Y3VzdG9tZXJpZCcsIGNvbnRhY3QpO1xyXG4gICAgICAgKi9cclxuICAgICAgc2V0TG9va3VwRnJvbVJldHJpZXZlKFxyXG4gICAgICAgIHNlbGVjdE5hbWU6IHN0cmluZyxcclxuICAgICAgICByZXRyaWV2ZWRSZWNvcmQ6IHsgW3g6IHN0cmluZ106IGFueSB9XHJcbiAgICAgICkge1xyXG4gICAgICAgIGlmICghc2VsZWN0TmFtZS5lbmRzV2l0aChcIl92YWx1ZVwiKSkgc2VsZWN0TmFtZSA9IGBfJHtzZWxlY3ROYW1lfV92YWx1ZWA7XHJcbiAgICAgICAgaWYgKCFyZXRyaWV2ZWRSZWNvcmQgfHwgIXJldHJpZXZlZFJlY29yZFtgJHtzZWxlY3ROYW1lfWBdKSB7XHJcbiAgICAgICAgICB0aGlzLlZhbHVlID0gbnVsbDtcclxuICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5WYWx1ZSA9IFtcclxuICAgICAgICAgIHtcclxuICAgICAgICAgICAgaWQ6IHJldHJpZXZlZFJlY29yZFtgJHtzZWxlY3ROYW1lfWBdLFxyXG4gICAgICAgICAgICBlbnRpdHlUeXBlOlxyXG4gICAgICAgICAgICAgIHJldHJpZXZlZFJlY29yZFtcclxuICAgICAgICAgICAgICAgIGAke3NlbGVjdE5hbWV9QE1pY3Jvc29mdC5EeW5hbWljcy5DUk0ubG9va3VwbG9naWNhbG5hbWVgXHJcbiAgICAgICAgICAgICAgXSxcclxuICAgICAgICAgICAgbmFtZTogcmV0cmlldmVkUmVjb3JkW1xyXG4gICAgICAgICAgICAgIGAke3NlbGVjdE5hbWV9QE9EYXRhLkNvbW11bml0eS5EaXNwbGF5LlYxLkZvcm1hdHRlZFZhbHVlYFxyXG4gICAgICAgICAgICBdLFxyXG4gICAgICAgICAgfSxcclxuICAgICAgICBdO1xyXG4gICAgICB9XHJcbiAgICAgIHRzSWdGdW5jdCgpOiBib29sZWFuIHtcclxuICAgICAgICAvLyBAdHMtaWdub3JlXHJcbiAgICAgICAgcmV0dXJuIFhybS5XZWJBcGkub2ZmbGluZS5pc0F2YWlsYWJsZU9mZmxpbmUodGhpcy5FbnRpdHlUeXBlKTtcclxuICAgICAgfVxyXG4gICAgICAvLyB0ZXN0XHJcbiAgICAgIC8qKlxyXG4gICAgICAgKiBSZXR1cm5zIG5hdGl2ZSBTREsgV2ViQXBpIGFwcHJvcHJpYXRlIGZvciB0aGUgY3VycmVudCBjbGllbnQgc3RhdGVcclxuICAgICAgICogQHJldHVybnMgWHJtLldlYkFwaU9mZmxpbmUgb3IgWHJtLldlYkFwaU9ubGluZVxyXG4gICAgICAgKi9cclxuICAgICAgLy8gZ2V0WHJtV2ViQXBpKCk6IFhybS5XZWJBcGlPZmZsaW5lIHwgWHJtLldlYkFwaU9ubGluZSB7XHJcbiAgICAgIGdldFhybVdlYkFwaSgpOiBhbnkge1xyXG4gICAgICAgIGlmIChpc09mZmxpbmUoKSA9PT0gdHJ1ZSkge1xyXG4gICAgICAgICAgcmV0dXJuIFhybS5XZWJBcGkub2ZmbGluZTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgcmV0dXJuIFhybS5XZWJBcGkub25saW5lO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgICAvLyBXb3JrIGluIHByb2dyZXNzIGJlbG93IVxyXG4gICAgICAvLyBnZXRYcm1XZWJBcGkoKTogWHJtLldlYkFwaU9mZmxpbmUgfCBYcm0uV2ViQXBpT25saW5lIHtcclxuICAgICAgLy8gICBpZiAoaXNPZmZsaW5lKCkgPT09IHRydWUpIHtcclxuICAgICAgLy8gICAgIGlmICh0aGlzLl9pc0VudGl0eUF2YWlsYWJsZU9mZmxpbmUgPT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAvLyAgICAgICB0aGlzLl9pc0VudGl0eUF2YWlsYWJsZU9mZmxpbmUgPSB0aGlzLnRzSWdGdW5jdCgpO1xyXG5cclxuICAgICAgLy8gICAgICAgaWYgKHRoaXMuX2lzRW50aXR5QXZhaWxhYmxlT2ZmbGluZSA9PT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgIC8vICAgICAgICAgWHJtRXgudGhyb3dFcnJvcihcclxuICAgICAgLy8gICAgICAgICAgIFwiVW5hYmxlIHRvIGRldGVybWluZSBvZmZsaW5lIGF2YWlsYWJpbGl0eSBmb3IgZW50aXR5OiBcIiArXHJcbiAgICAgIC8vICAgICAgICAgICAgIHRoaXMuRW50aXR5VHlwZVxyXG4gICAgICAvLyAgICAgICAgICk7XHJcbiAgICAgIC8vICAgICAgIH1cclxuXHJcbiAgICAgIC8vICAgICAgIC8vIFJlY3Vyc2l2ZSBjYWxsIHRvIHNlbGYsIHZhbHVlIHNob3VsZCBub3cgYmUgZWl0aGVyIHRydWUgb3IgZmFsc2VcclxuICAgICAgLy8gICAgICAgdGhpcy5nZXRYcm1XZWJBcGkoKTtcclxuICAgICAgLy8gICAgIH0gZWxzZSBpZiAodGhpcy5faXNFbnRpdHlBdmFpbGFibGVPZmZsaW5lID09PSB0cnVlKSB7XHJcbiAgICAgIC8vICAgICAgIHJldHVybiBYcm0uV2ViQXBpLm9mZmxpbmU7XHJcbiAgICAgIC8vICAgICB9IGVsc2Uge1xyXG4gICAgICAvLyAgICAgICB0aHJvd0Vycm9yKFwiVGhpcyBlbnRpdHkgaXMgbm90IGF2YWlsYWJsZSBpbiBvZmZsaW5lIG1vZGVcIik7XHJcbiAgICAgIC8vICAgICB9XHJcbiAgICAgIC8vICAgfSBlbHNlIHtcclxuICAgICAgLy8gICAgIHJldHVybiBYcm0uV2ViQXBpLm9ubGluZTtcclxuICAgICAgLy8gICB9XHJcbiAgICAgIC8vIH1cclxuICAgICAgLyoqXHJcbiAgICAgICAqIFJldHJpZXZlcyBhbiBlbnRpdHkgcmVjb3JkLlxyXG4gICAgICAgKiBAcGFyYW0gb3B0aW9ucyAoT3B0aW9uYWwpIE9EYXRhIHN5c3RlbSBxdWVyeSBvcHRpb25zLCAkc2VsZWN0IGFuZCAkZXhwYW5kLCB0byByZXRyaWV2ZSB5b3VyIGRhdGEuXHJcbiAgICAgICAqIC0gVXNlIHRoZSAkc2VsZWN0IHN5c3RlbSBxdWVyeSBvcHRpb24gdG8gbGltaXQgdGhlIHByb3BlcnRpZXMgcmV0dXJuZWQgYnkgaW5jbHVkaW5nIGEgY29tbWEtc2VwYXJhdGVkXHJcbiAgICAgICAqICAgbGlzdCBvZiBwcm9wZXJ0eSBuYW1lcy4gVGhpcyBpcyBhbiBpbXBvcnRhbnQgcGVyZm9ybWFuY2UgYmVzdCBwcmFjdGljZS4gSWYgcHJvcGVydGllcyBhcmVu4oCZdFxyXG4gICAgICAgKiAgIHNwZWNpZmllZCB1c2luZyAkc2VsZWN0LCBhbGwgcHJvcGVydGllcyB3aWxsIGJlIHJldHVybmVkLlxyXG4gICAgICAgKiAtIFVzZSB0aGUgJGV4cGFuZCBzeXN0ZW0gcXVlcnkgb3B0aW9uIHRvIGNvbnRyb2wgd2hhdCBkYXRhIGZyb20gcmVsYXRlZCBlbnRpdGllcyBpcyByZXR1cm5lZC4gSWYgeW91XHJcbiAgICAgICAqICAganVzdCBpbmNsdWRlIHRoZSBuYW1lIG9mIHRoZSBuYXZpZ2F0aW9uIHByb3BlcnR5LCB5b3XigJlsbCByZWNlaXZlIGFsbCB0aGUgcHJvcGVydGllcyBmb3IgcmVsYXRlZFxyXG4gICAgICAgKiAgIHJlY29yZHMuIFlvdSBjYW4gbGltaXQgdGhlIHByb3BlcnRpZXMgcmV0dXJuZWQgZm9yIHJlbGF0ZWQgcmVjb3JkcyB1c2luZyB0aGUgJHNlbGVjdCBzeXN0ZW0gcXVlcnlcclxuICAgICAgICogICBvcHRpb24gaW4gcGFyZW50aGVzZXMgYWZ0ZXIgdGhlIG5hdmlnYXRpb24gcHJvcGVydHkgbmFtZS4gVXNlIHRoaXMgZm9yIGJvdGggc2luZ2xlLXZhbHVlZCBhbmRcclxuICAgICAgICogICBjb2xsZWN0aW9uLXZhbHVlZCBuYXZpZ2F0aW9uIHByb3BlcnRpZXMuXHJcbiAgICAgICAqIC0gWW91IGNhbiBhbHNvIHNwZWNpZnkgbXVsdGlwbGUgcXVlcnkgb3B0aW9ucyBieSB1c2luZyAmIHRvIHNlcGFyYXRlIHRoZSBxdWVyeSBvcHRpb25zLlxyXG4gICAgICAgKiBAZXhhbXBsZSA8Y2FwdGlvbj5vcHRpb25zIGV4YW1wbGU6PC9jYXB0aW9uPlxyXG4gICAgICAgKiBvcHRpb25zOiAkc2VsZWN0PW5hbWUmJGV4cGFuZD1wcmltYXJ5Y29udGFjdGlkKCRzZWxlY3Q9Y29udGFjdGlkLGZ1bGxuYW1lKVxyXG4gICAgICAgKiBAcmV0dXJucyBPbiBzdWNjZXNzLCByZXR1cm5zIGEgcHJvbWlzZSBjb250YWluaW5nIGEgSlNPTiBvYmplY3Qgd2l0aCB0aGUgcmV0cmlldmVkIGF0dHJpYnV0ZXMgYW5kIHRoZWlyIHZhbHVlcy5cclxuICAgICAgICogQHNlZSB7QGxpbmsgaHR0cHM6Ly9kb2NzLm1pY3Jvc29mdC5jb20vZW4tdXMvZHluYW1pY3MzNjUvY3VzdG9tZXItZW5nYWdlbWVudC9kZXZlbG9wZXIvY2xpZW50YXBpL3JlZmVyZW5jZS94cm0td2ViYXBpL3JldHJpZXZlcmVjb3JkIEV4dGVybmFsIExpbms6IHJldHJpZXZlUmVjb3JkIChDbGllbnQgQVBJIHJlZmVyZW5jZSl9XHJcbiAgICAgICAqL1xyXG4gICAgICBhc3luYyByZXRyaWV2ZShvcHRpb25zOiBzdHJpbmcpIHtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgaWYgKCF0aGlzLklkIHx8ICF0aGlzLkVudGl0eVR5cGUpIHJldHVybiBudWxsO1xyXG4gICAgICAgICAgY29uc3QgcmVjb3JkID0gYXdhaXQgWHJtLldlYkFwaS5yZXRyaWV2ZVJlY29yZChcclxuICAgICAgICAgICAgdGhpcy5FbnRpdHlUeXBlLFxyXG4gICAgICAgICAgICB0aGlzLklkLFxyXG4gICAgICAgICAgICBvcHRpb25zXHJcbiAgICAgICAgICApO1xyXG4gICAgICAgICAgcmV0dXJuIHJlY29yZDtcclxuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XHJcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXHJcbiAgICAgICAgICAgIGBYcm1FeC4ke1hybUV4LmdldEZ1bmN0aW9uTmFtZSgpfTpcXG4ke2Vycm9yLm1lc3NhZ2V9YFxyXG4gICAgICAgICAgKTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgICAgLyoqXHJcbiAgICAgICAqIFVwZGF0ZXMgYW4gZW50aXR5IHJlY29yZC5cclxuICAgICAgICogQHBhcmFtIGRhdGEgKHJlcXVpcmVkKSBBIEpTT04gb2JqZWN0IGNvbnRhaW5pbmcga2V5IDogdmFsdWUgcGFpcnMgd2hlcmUga2V5IGlzIHRoZSBhdHRyaWJ1dGUgb2YgdGhlIHRhYmxlXHJcbiAgICAgICAqIGFuZCB2YWx1ZSBpcyB0aGUgdmFsdWUgb2YgdGhlIGF0dHJpYnV0ZSB5b3Ugd2lzaCB0byB1cGRhdGUuXHJcbiAgICAgICAqIEBleGFtcGxlIDxjYXB0aW9uPmRhdGEgZXhhbXBsZTo8L2NhcHRpb24+XHJcbiAgICAgICAqIHZhciBkYXRhID1cclxuICAgICAgICogICB7XHJcbiAgICAgICAqICAgICBcIm5hbWVcIjogXCJVcGRhdGVkIFNhbXBsZSBBY2NvdW50IFwiLFxyXG4gICAgICAgKiAgICAgXCJjcmVkaXRvbmhvbGRcIjogdHJ1ZSxcclxuICAgICAgICogICAgIFwiYWRkcmVzczFfbGF0aXR1ZGVcIjogNDcuNjM5NTgzLFxyXG4gICAgICAgKiAgICAgXCJkZXNjcmlwdGlvblwiOiBcIlRoaXMgaXMgdGhlIHVwZGF0ZWQgZGVzY3JpcHRpb24gb2YgdGhlIHNhbXBsZSBhY2NvdW50XCIsXHJcbiAgICAgICAqICAgICBcInJldmVudWVcIjogNjAwMDAwMCxcclxuICAgICAgICogICAgIFwiYWNjb3VudGNhdGVnb3J5Y29kZVwiOiAyXHJcbiAgICAgICAqICAgfTtcclxuICAgICAgICogQHJldHVybnMgT24gc3VjY2VzcywgcmV0dXJucyBhIHByb21pc2Ugb2JqZWN0IHdpdGggZW50aXR5VHlwZSAoc3RyaW5nLCB0YWJsZSBuYW1lKSBhbmQgaWQgKHN0cmluZywgR1VJRCBvZiB0aGUgcmVjb3JkKVxyXG4gICAgICAgKiBAc2VlIHtAbGluayBodHRwczovL2xlYXJuLm1pY3Jvc29mdC5jb20vZW4tdXMvcG93ZXItYXBwcy9kZXZlbG9wZXIvbW9kZWwtZHJpdmVuLWFwcHMvY2xpZW50YXBpL3JlZmVyZW5jZS94cm0td2ViYXBpL3VwZGF0ZXJlY29yZH1cclxuICAgICAgICovXHJcbiAgICAgIGFzeW5jIHVwZGF0ZShkYXRhOiBvYmplY3QpOiBQcm9taXNlPGFueT4ge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICBpZiAoIXRoaXMuSWQgfHwgIXRoaXMuRW50aXR5VHlwZSB8fCAhZGF0YSkge1xyXG4gICAgICAgICAgICB0aHJvd0Vycm9yKFwiTWlzc2luZyByZXF1aXJlZCBhcmd1bWVudHMgZm9yIHVwZGF0ZSBtZXRob2RcIik7XHJcbiAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5nZXRYcm1XZWJBcGkoKS51cGRhdGVSZWNvcmQoXHJcbiAgICAgICAgICAgIHRoaXMuRW50aXR5VHlwZSxcclxuICAgICAgICAgICAgdGhpcy5JZCxcclxuICAgICAgICAgICAgZGF0YVxyXG4gICAgICAgICAgKTtcclxuXHJcbiAgICAgICAgICByZXR1cm4gcmVzdWx0O1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcclxuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcclxuICAgICAgICAgICAgYFhybUV4LiR7WHJtRXguZ2V0RnVuY3Rpb25OYW1lKCl9OlxcbiR7ZXJyb3IubWVzc2FnZX1gXHJcbiAgICAgICAgICApO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgICAvKipcclxuICAgICAgICogQWRkcyBhbiBhZGRpdGlvbmFsIGN1c3RvbSBmaWx0ZXIgdG8gdGhlIGxvb2t1cCwgd2l0aCB0aGUgXCJBTkRcIiBmaWx0ZXIgb3BlcmF0b3IuXHJcbiAgICAgICAqIEBwYXJhbSBmaWx0ZXIgU3BlY2lmaWVzIHRoZSBmaWx0ZXIsIGFzIGEgc2VyaWFsaXplZCBGZXRjaFhNTCBcImZpbHRlclwiIG5vZGUuXHJcbiAgICAgICAqIEBwYXJhbSBlbnRpdHlMb2dpY2FsTmFtZSAoT3B0aW9uYWwpIFRoZSBsb2dpY2FsIG5hbWUgb2YgdGhlIGVudGl0eS5cclxuICAgICAgICogQHJlbWFya3MgICAgIElmIGVudGl0eUxvZ2ljYWxOYW1lIGlzIG5vdCBzcGVjaWZpZWQsIHRoZSBmaWx0ZXIgd2lsbCBiZSBhcHBsaWVkIHRvIGFsbCBlbnRpdGllc1xyXG4gICAgICAgKiAgICAgICAgICAgICAgdmFsaWQgZm9yIHRoZSBMb29rdXAgY29udHJvbC5cclxuICAgICAgICogQGV4YW1wbGUgICAgIEV4YW1wbGUgZmlsdGVyOiA8ZmlsdGVyIHR5cGU9XCJhbmRcIj5cclxuICAgICAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8Y29uZGl0aW9uIGF0dHJpYnV0ZT1cImFkZHJlc3MxX2NpdHlcIiBvcGVyYXRvcj1cImVxXCIgdmFsdWU9XCJSZWRtb25kXCIgLz5cclxuICAgICAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L2ZpbHRlcj5cclxuICAgICAgICovXHJcbiAgICAgIGFkZFByZUZpbHRlclRvTG9va3VwKFxyXG4gICAgICAgIGZpbHRlclhtbDogc3RyaW5nLFxyXG4gICAgICAgIGVudGl0eUxvZ2ljYWxOYW1lPzogc3RyaW5nXHJcbiAgICAgICk6IHRoaXMge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICBfYWRkQ3VzdG9tRmlsdGVyLmNvbnRyb2xzID0gdGhpcy5jb250cm9scztcclxuICAgICAgICAgIHRoaXMuY29udHJvbHMuZm9yRWFjaCgoY29udHJvbCkgPT4ge1xyXG4gICAgICAgICAgICBjb250cm9sLmFkZFByZVNlYXJjaChfYWRkQ3VzdG9tRmlsdGVyKTtcclxuICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgdGhpcy5fY3VzdG9tRmlsdGVycy5wdXNoKF9hZGRDdXN0b21GaWx0ZXIpO1xyXG4gICAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xyXG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxyXG4gICAgICAgICAgICBgWHJtRXguJHtYcm1FeC5nZXRGdW5jdGlvbk5hbWUoKX06XFxuJHtlcnJvci5tZXNzYWdlfWBcclxuICAgICAgICAgICk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBmdW5jdGlvbiBfYWRkQ3VzdG9tRmlsdGVyKCkge1xyXG4gICAgICAgICAgX2FkZEN1c3RvbUZpbHRlci5jb250cm9scy5mb3JFYWNoKChjb250cm9sKSA9PiB7XHJcbiAgICAgICAgICAgIGNvbnRyb2wuYWRkQ3VzdG9tRmlsdGVyKGZpbHRlclhtbCwgZW50aXR5TG9naWNhbE5hbWUpO1xyXG4gICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICAgIC8qKlxyXG4gICAgICAgKiBBZGRzIGFuIGFkZGl0aW9uYWwgY3VzdG9tIGZpbHRlciB0byB0aGUgbG9va3VwLCB3aXRoIHRoZSBcIkFORFwiIGZpbHRlciBvcGVyYXRvci5cclxuICAgICAgICogQHBhcmFtIGVudGl0eUxvZ2ljYWxOYW1lIChPcHRpb25hbCkgVGhlIGxvZ2ljYWwgbmFtZSBvZiB0aGUgZW50aXR5LlxyXG4gICAgICAgKiBAcGFyYW0gcHJpbWFyeUF0dHJpYnV0ZUlkTmFtZSAoT3B0aW9uYWwpIFRoZSBsb2dpY2FsIG5hbWUgb2YgdGhlIHByaW1hcnkga2V5LlxyXG4gICAgICAgKiBAcGFyYW0gZmV0Y2hYbWwgU3BlY2lmaWVzIHRoZSBGZXRjaFhNTCB1c2VkIHRvIGZpbHRlci5cclxuICAgICAgICogQHJlbWFya3MgICAgIElmIGVudGl0eUxvZ2ljYWxOYW1lIGlzIG5vdCBzcGVjaWZpZWQsIHRoZSBmaWx0ZXIgd2lsbCBiZSBhcHBsaWVkIHRvIGFsbCBlbnRpdGllc1xyXG4gICAgICAgKiAgICAgICAgICAgICAgdmFsaWQgZm9yIHRoZSBMb29rdXAgY29udHJvbC5cclxuICAgICAgICogQGV4YW1wbGUgICAgIEV4YW1wbGUgZmV0Y2hYbWw6IDxmZXRjaD5cclxuICAgICAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8ZW50aXR5IG5hbWU9XCJjb250YWN0XCI+XHJcbiAgICAgICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxmaWx0ZXI+XHJcbiAgICAgICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxjb25kaXRpb24gYXR0cmlidXRlPVwiYWRkcmVzczFfY2l0eVwiIG9wZXJhdG9yPVwiZXFcIiB2YWx1ZT1cIlJlZG1vbmRcIiAvPlxyXG4gICAgICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L2ZpbHRlcj5cclxuICAgICAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L2VudGl0eT5cclxuICAgICAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L2ZldGNoPlxyXG4gICAgICAgKi9cclxuICAgICAgYXN5bmMgYWRkUHJlRmlsdGVyVG9Mb29rdXBBZHZhbmNlZChcclxuICAgICAgICBlbnRpdHlMb2dpY2FsTmFtZTogc3RyaW5nLFxyXG4gICAgICAgIHByaW1hcnlBdHRyaWJ1dGVJZE5hbWU6IHN0cmluZyxcclxuICAgICAgICBmZXRjaFhtbDogc3RyaW5nXHJcbiAgICAgICk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBYcm0uV2ViQXBpLm9ubGluZS5yZXRyaWV2ZU11bHRpcGxlUmVjb3JkcyhcclxuICAgICAgICAgICAgZW50aXR5TG9naWNhbE5hbWUsXHJcbiAgICAgICAgICAgIFwiP2ZldGNoWG1sPVwiICsgZmV0Y2hYbWxcclxuICAgICAgICAgICk7XHJcbiAgICAgICAgICBjb25zdCBkYXRhID0gcmVzdWx0LmVudGl0aWVzO1xyXG4gICAgICAgICAgbGV0IGZpbHRlcmVkRW50aXRpZXMgPSBcIlwiO1xyXG4gICAgICAgICAgX2FkZEN1c3RvbUZpbHRlci5jb250cm9scyA9IHRoaXMuY29udHJvbHM7XHJcbiAgICAgICAgICBkYXRhLmZvckVhY2goKGl0ZW0pID0+IHtcclxuICAgICAgICAgICAgZmlsdGVyZWRFbnRpdGllcyArPSBgPHZhbHVlPiR7aXRlbVtwcmltYXJ5QXR0cmlidXRlSWROYW1lXX08L3ZhbHVlPmA7XHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICAgIGZldGNoWG1sID0gZmlsdGVyZWRFbnRpdGllc1xyXG4gICAgICAgICAgICA/IGA8ZmlsdGVyPjxjb25kaXRpb24gYXR0cmlidXRlPScke3ByaW1hcnlBdHRyaWJ1dGVJZE5hbWV9JyBvcGVyYXRvcj0naW4nPiR7ZmlsdGVyZWRFbnRpdGllc308L2NvbmRpdGlvbj48L2ZpbHRlcj5gXHJcbiAgICAgICAgICAgIDogYDxmaWx0ZXI+PGNvbmRpdGlvbiBhdHRyaWJ1dGU9JyR7cHJpbWFyeUF0dHJpYnV0ZUlkTmFtZX0nIG9wZXJhdG9yPSdudWxsJy8+PC9maWx0ZXI+YDtcclxuICAgICAgICAgIHRoaXMuY29udHJvbHMuZm9yRWFjaCgoY29udHJvbCkgPT4ge1xyXG4gICAgICAgICAgICBjb250cm9sLmFkZFByZVNlYXJjaChfYWRkQ3VzdG9tRmlsdGVyKTtcclxuICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgdGhpcy5fY3VzdG9tRmlsdGVycy5wdXNoKF9hZGRDdXN0b21GaWx0ZXIpO1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcclxuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcclxuICAgICAgICAgICAgYFhybUV4LiR7WHJtRXguZ2V0RnVuY3Rpb25OYW1lKCl9OlxcbiR7ZXJyb3IubWVzc2FnZX1gXHJcbiAgICAgICAgICApO1xyXG4gICAgICAgIH1cclxuICAgICAgICBmdW5jdGlvbiBfYWRkQ3VzdG9tRmlsdGVyKCkge1xyXG4gICAgICAgICAgX2FkZEN1c3RvbUZpbHRlci5jb250cm9scy5mb3JFYWNoKChjb250cm9sKSA9PiB7XHJcbiAgICAgICAgICAgIGNvbnRyb2wuYWRkQ3VzdG9tRmlsdGVyKGZldGNoWG1sLCBlbnRpdHlMb2dpY2FsTmFtZSk7XHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgICAgLyoqXHJcbiAgICAgICAqIFJlbW92ZXMgYWxsIGZpbHRlcnMgc2V0IG9uIHRoZSBjdXJyZW50IGxvb2t1cCBhdHRyaWJ1dGUgYnkgdXNpbmcgYWRkUHJlRmlsdGVyVG9Mb29rdXAgb3IgYWRkUHJlRmlsdGVyVG9Mb29rdXBBZHZhbmNlZFxyXG4gICAgICAgKi9cclxuICAgICAgY2xlYXJQcmVGaWx0ZXJGcm9tTG9va3VwKCk6IHRoaXMge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICB0aGlzLl9jdXN0b21GaWx0ZXJzLmZvckVhY2goXHJcbiAgICAgICAgICAgIChjdXN0b21GaWx0ZXI6IFhybS5FdmVudHMuQ29udGV4dFNlbnNpdGl2ZUhhbmRsZXIpID0+IHtcclxuICAgICAgICAgICAgICB0aGlzLmNvbnRyb2xzLmZvckVhY2goKGNvbnRyb2wpID0+IHtcclxuICAgICAgICAgICAgICAgIGNvbnRyb2wucmVtb3ZlUHJlU2VhcmNoKGN1c3RvbUZpbHRlcik7XHJcbiAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICk7XHJcbiAgICAgICAgICByZXR1cm4gdGhpcztcclxuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XHJcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXHJcbiAgICAgICAgICAgIGBYcm1FeC4ke1hybUV4LmdldEZ1bmN0aW9uTmFtZSgpfTpcXG4ke2Vycm9yLm1lc3NhZ2V9YFxyXG4gICAgICAgICAgKTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH1cclxuICAgIHR5cGUgT3B0aW9uVmFsdWVzID0ge1xyXG4gICAgICBba2V5OiBzdHJpbmddOiBudW1iZXI7XHJcbiAgICB9O1xyXG4gICAgZXhwb3J0IGNsYXNzIE9wdGlvbnNldEZpZWxkPE9wdGlvbnMgZXh0ZW5kcyBPcHRpb25WYWx1ZXM+XHJcbiAgICAgIGV4dGVuZHMgRmllbGRcclxuICAgICAgaW1wbGVtZW50cyBYcm0uQXR0cmlidXRlcy5PcHRpb25TZXRBdHRyaWJ1dGVcclxuICAgIHtcclxuICAgICAgcHJvdGVjdGVkIGRlY2xhcmUgX2F0dHJpYnV0ZTogWHJtLkF0dHJpYnV0ZXMuT3B0aW9uU2V0QXR0cmlidXRlO1xyXG4gICAgICBwcm90ZWN0ZWQgX2NvbnRyb2whOiBYcm0uQ29udHJvbHMuT3B0aW9uU2V0Q29udHJvbDtcclxuICAgICAgT3B0aW9uOiBPcHRpb25zO1xyXG4gICAgICBjb25zdHJ1Y3RvcihhdHRyaWJ1dGVOYW1lOiBzdHJpbmcsIG9wdGlvbj86IE9wdGlvbnMpIHtcclxuICAgICAgICBzdXBlcihhdHRyaWJ1dGVOYW1lKTtcclxuICAgICAgICB0aGlzLk9wdGlvbiA9IG9wdGlvbjtcclxuICAgICAgfVxyXG4gICAgICBnZXRGb3JtYXQoKTogWHJtLkF0dHJpYnV0ZXMuT3B0aW9uU2V0QXR0cmlidXRlRm9ybWF0IHtcclxuICAgICAgICByZXR1cm4gdGhpcy5BdHRyaWJ1dGUuZ2V0Rm9ybWF0KCkgYXMgWHJtLkF0dHJpYnV0ZXMuT3B0aW9uU2V0QXR0cmlidXRlRm9ybWF0O1xyXG4gICAgICB9XHJcbiAgICAgIGdldE9wdGlvbih2YWx1ZTogbnVtYmVyIHwgc3RyaW5nKTogWHJtLk9wdGlvblNldFZhbHVlIHtcclxuICAgICAgICBpZiAodHlwZW9mIHZhbHVlID09PSBcIm51bWJlclwiKSB7XHJcbiAgICAgICAgICByZXR1cm4gdGhpcy5BdHRyaWJ1dGUuZ2V0T3B0aW9uKHZhbHVlKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgcmV0dXJuIHRoaXMuQXR0cmlidXRlLmdldE9wdGlvbih2YWx1ZSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICAgIGdldE9wdGlvbnMoKTogWHJtLk9wdGlvblNldFZhbHVlW10ge1xyXG4gICAgICAgIHJldHVybiB0aGlzLkF0dHJpYnV0ZS5nZXRPcHRpb25zKCk7XHJcbiAgICAgIH1cclxuICAgICAgZ2V0U2VsZWN0ZWRPcHRpb24oKTogWHJtLk9wdGlvblNldFZhbHVlIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5BdHRyaWJ1dGUuZ2V0U2VsZWN0ZWRPcHRpb24oKTtcclxuICAgICAgfVxyXG4gICAgICBnZXRUZXh0KCk6IHN0cmluZyB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuQXR0cmlidXRlLmdldFRleHQoKTtcclxuICAgICAgfVxyXG4gICAgICBnZXRJbml0aWFsVmFsdWUoKTogbnVtYmVyIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5BdHRyaWJ1dGUuZ2V0SW5pdGlhbFZhbHVlKCk7XHJcbiAgICAgIH1cclxuICAgICAgZ2V0IEF0dHJpYnV0ZSgpIHtcclxuICAgICAgICByZXR1cm4gKHRoaXMuX2F0dHJpYnV0ZSA/Pz1cclxuICAgICAgICAgIEZvcm0uZm9ybUNvbnRleHQuZ2V0QXR0cmlidXRlKHRoaXMuTmFtZSkgPz9cclxuICAgICAgICAgIFhybUV4LnRocm93RXJyb3IoYEZpZWxkICcke3RoaXMuTmFtZX0nIGRvZXMgbm90IGV4aXN0YCkpO1xyXG4gICAgICB9XHJcbiAgICAgIGdldCBjb250cm9scygpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5BdHRyaWJ1dGUuY29udHJvbHM7XHJcbiAgICAgIH1cclxuICAgICAgZ2V0IGNvbnRyb2woKSB7XHJcbiAgICAgICAgcmV0dXJuICh0aGlzLl9jb250cm9sID8/PVxyXG4gICAgICAgICAgRm9ybS5mb3JtQ29udGV4dC5nZXRDb250cm9sKHRoaXMuTmFtZSkgPz9cclxuICAgICAgICAgIFhybUV4LnRocm93RXJyb3IoYENvbnRyb2wgJyR7dGhpcy5OYW1lfScgZG9lcyBub3QgZXhpc3RgKSk7XHJcbiAgICAgIH1cclxuICAgICAgZ2V0IFZhbHVlKCk6IG51bWJlciB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuQXR0cmlidXRlLmdldFZhbHVlKCk7XHJcbiAgICAgIH1cclxuICAgICAgc2V0IFZhbHVlKHZhbHVlOiBrZXlvZiBPcHRpb25zIHwgbnVtYmVyKSB7XHJcbiAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSA9PSBcIm51bWJlclwiKSB0aGlzLkF0dHJpYnV0ZS5zZXRWYWx1ZSh2YWx1ZSk7XHJcbiAgICAgICAgZWxzZSB0aGlzLkF0dHJpYnV0ZS5zZXRWYWx1ZSh0aGlzLk9wdGlvblt2YWx1ZV0pO1xyXG4gICAgICB9XHJcbiAgICAgIC8qKlxyXG4gICAgICAgKiBBZGRzIGFuIG9wdGlvbi5cclxuICAgICAgICpcclxuICAgICAgICogQHBhcmFtIHZhbHVlcyBhbiBhcnJheSB3aXRoIHRoZSBvcHRpb24gdmFsdWVzIHRvIGFkZFxyXG4gICAgICAgKiBAcGFyYW0gaW5kZXggKE9wdGlvbmFsKSB6ZXJvLWJhc2VkIGluZGV4IG9mIHRoZSBvcHRpb24uXHJcbiAgICAgICAqXHJcbiAgICAgICAqIEByZW1hcmtzIFRoaXMgbWV0aG9kIGRvZXMgbm90IGNoZWNrIHRoYXQgdGhlIHZhbHVlcyB3aXRoaW4gdGhlIG9wdGlvbnMgeW91IGFkZCBhcmUgdmFsaWQuXHJcbiAgICAgICAqICAgICAgICAgIElmIGluZGV4IGlzIG5vdCBwcm92aWRlZCwgdGhlIG5ldyBvcHRpb24gd2lsbCBiZSBhZGRlZCB0byB0aGUgZW5kIG9mIHRoZSBsaXN0LlxyXG4gICAgICAgKi9cclxuICAgICAgYWRkT3B0aW9uKHZhbHVlczogbnVtYmVyW10sIGluZGV4PzogbnVtYmVyKTogdGhpcyB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgIGlmICghQXJyYXkuaXNBcnJheSh2YWx1ZXMpKVxyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYHZhbHVlcyBpcyBub3QgYW4gQXJyYXk6XFxudmFsdWVzOiAnJHt2YWx1ZXN9J2ApO1xyXG4gICAgICAgICAgY29uc3Qgb3B0aW9uU2V0VmFsdWVzID1cclxuICAgICAgICAgICAgdGhpcy5jb250cm9sLmdldEF0dHJpYnV0ZSgpLmdldE9wdGlvbnMoKSA/PyBbXTtcclxuICAgICAgICAgIGZvciAoY29uc3QgZWxlbWVudCBvZiBvcHRpb25TZXRWYWx1ZXMpIHtcclxuICAgICAgICAgICAgaWYgKHZhbHVlcy5pbmNsdWRlcyhlbGVtZW50LnZhbHVlKSkge1xyXG4gICAgICAgICAgICAgIHRoaXMuY29udHJvbC5hZGRPcHRpb24oZWxlbWVudCwgaW5kZXgpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICByZXR1cm4gdGhpcztcclxuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XHJcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXHJcbiAgICAgICAgICAgIGBYcm1FeC4ke1hybUV4LmdldEZ1bmN0aW9uTmFtZSgpfTpcXG4ke2Vycm9yLm1lc3NhZ2V9YFxyXG4gICAgICAgICAgKTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgICAgLyoqXHJcbiAgICAgICAqIFJlbW92ZXMgdGhlIG9wdGlvbiBtYXRjaGluZyB0aGUgdmFsdWUuXHJcbiAgICAgICAqXHJcbiAgICAgICAqIEBwYXJhbSB2YWx1ZSBUaGUgdmFsdWUuXHJcbiAgICAgICAqL1xyXG4gICAgICByZW1vdmVPcHRpb24odmFsdWVzOiBudW1iZXJbXSk6IHRoaXMge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICBpZiAoIUFycmF5LmlzQXJyYXkodmFsdWVzKSlcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGB2YWx1ZXMgaXMgbm90IGFuIEFycmF5OlxcbnZhbHVlczogJyR7dmFsdWVzfSdgKTtcclxuICAgICAgICAgIGNvbnN0IG9wdGlvblNldFZhbHVlcyA9XHJcbiAgICAgICAgICAgIHRoaXMuY29udHJvbC5nZXRBdHRyaWJ1dGUoKS5nZXRPcHRpb25zKCkgPz8gW107XHJcbiAgICAgICAgICBmb3IgKGNvbnN0IGVsZW1lbnQgb2Ygb3B0aW9uU2V0VmFsdWVzKSB7XHJcbiAgICAgICAgICAgIGlmICh2YWx1ZXMuaW5jbHVkZXMoZWxlbWVudC52YWx1ZSkpIHtcclxuICAgICAgICAgICAgICB0aGlzLmNvbnRyb2wucmVtb3ZlT3B0aW9uKGVsZW1lbnQudmFsdWUpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICByZXR1cm4gdGhpcztcclxuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XHJcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXHJcbiAgICAgICAgICAgIGBYcm1FeC4ke1hybUV4LmdldEZ1bmN0aW9uTmFtZSgpfTpcXG4ke2Vycm9yLm1lc3NhZ2V9YFxyXG4gICAgICAgICAgKTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgICAgLyoqXHJcbiAgICAgICAqIENsZWFycyBhbGwgb3B0aW9ucy5cclxuICAgICAgICovXHJcbiAgICAgIGNsZWFyT3B0aW9ucygpOiB0aGlzIHtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgdGhpcy5jb250cm9sLmNsZWFyT3B0aW9ucygpO1xyXG4gICAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xyXG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxyXG4gICAgICAgICAgICBgWHJtRXguJHtYcm1FeC5nZXRGdW5jdGlvbk5hbWUoKX06XFxuJHtlcnJvci5tZXNzYWdlfWBcclxuICAgICAgICAgICk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgICBleHBvcnQgY2xhc3MgU2VjdGlvbiBpbXBsZW1lbnRzIFhybS5Db250cm9scy5TZWN0aW9uIHtcclxuICAgICAgcHVibGljIHJlYWRvbmx5IE5hbWUhOiBzdHJpbmc7XHJcbiAgICAgIHByb3RlY3RlZCBfc2VjdGlvbj86IFhybS5Db250cm9scy5TZWN0aW9uO1xyXG4gICAgICBwdWJsaWMgcGFyZW50VGFiPzogWHJtLkNvbnRyb2xzLlRhYjtcclxuICAgICAgY29uc3RydWN0b3IobmFtZTogc3RyaW5nKSB7XHJcbiAgICAgICAgdGhpcy5OYW1lID0gbmFtZTtcclxuICAgICAgfVxyXG4gICAgICBwdWJsaWMgZ2V0IFNlY3Rpb24oKTogWHJtLkNvbnRyb2xzLlNlY3Rpb24ge1xyXG4gICAgICAgIHJldHVybiAodGhpcy5fc2VjdGlvbiA/Pz1cclxuICAgICAgICAgIHRoaXMucGFyZW50VGFiLnNlY3Rpb25zLmdldCh0aGlzLk5hbWUpID8/XHJcbiAgICAgICAgICBYcm1FeC50aHJvd0Vycm9yKFxyXG4gICAgICAgICAgICBgVGhlIHNlY3Rpb24gJyR7dGhpcy5OYW1lfScgd2FzIG5vdCBmb3VuZCBvbiB0aGUgZm9ybS5gXHJcbiAgICAgICAgICApKTtcclxuICAgICAgfVxyXG4gICAgICBnZXROYW1lKCk6IHN0cmluZyB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuU2VjdGlvbi5nZXROYW1lKCk7XHJcbiAgICAgIH1cclxuICAgICAgZ2V0UGFyZW50KCk6IFhybS5Db250cm9scy5UYWIge1xyXG4gICAgICAgIHJldHVybiB0aGlzLlNlY3Rpb24uZ2V0UGFyZW50KCk7XHJcbiAgICAgIH1cclxuICAgICAgY29udHJvbHM6IFhybS5Db2xsZWN0aW9uLkl0ZW1Db2xsZWN0aW9uPFhybS5Db250cm9scy5Db250cm9sPjtcclxuICAgICAgc2V0VmlzaWJsZSh2aXNpYmxlOiBib29sZWFuKTogdm9pZCB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuU2VjdGlvbi5zZXRWaXNpYmxlKHZpc2libGUpO1xyXG4gICAgICB9XHJcbiAgICAgIGdldFZpc2libGUoKTogYm9vbGVhbiB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuU2VjdGlvbi5nZXRWaXNpYmxlKCk7XHJcbiAgICAgIH1cclxuICAgICAgZ2V0TGFiZWwoKTogc3RyaW5nIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5TZWN0aW9uLmdldExhYmVsKCk7XHJcbiAgICAgIH1cclxuICAgICAgc2V0TGFiZWwobGFiZWw6IHN0cmluZyk6IHZvaWQge1xyXG4gICAgICAgIHJldHVybiB0aGlzLlNlY3Rpb24uc2V0TGFiZWwobGFiZWwpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgICB0eXBlIFRhYlNlY3Rpb25zID0ge1xyXG4gICAgICBba2V5OiBzdHJpbmddOiBTZWN0aW9uO1xyXG4gICAgfTtcclxuICAgIGV4cG9ydCBjbGFzcyBUYWI8U2VjdGlvbnMgZXh0ZW5kcyBUYWJTZWN0aW9ucz4gaW1wbGVtZW50cyBYcm0uQ29udHJvbHMuVGFiIHtcclxuICAgICAgcHVibGljIHJlYWRvbmx5IE5hbWUhOiBzdHJpbmc7XHJcbiAgICAgIHByb3RlY3RlZCBfdGFiPzogWHJtLkNvbnRyb2xzLlRhYjtcclxuICAgICAgU2VjdGlvbjogU2VjdGlvbnM7XHJcbiAgICAgIGNvbnN0cnVjdG9yKG5hbWU6IHN0cmluZywgc2VjdGlvbj86IFNlY3Rpb25zKSB7XHJcbiAgICAgICAgdGhpcy5OYW1lID0gbmFtZTtcclxuICAgICAgICB0aGlzLlNlY3Rpb24gPSBzZWN0aW9uO1xyXG4gICAgICAgIGZvciAobGV0IGtleSBpbiBzZWN0aW9uKSB7XHJcbiAgICAgICAgICBzZWN0aW9uW2tleV0ucGFyZW50VGFiID0gdGhpcztcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgICAgZ2V0IHNlY3Rpb25zKCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLlRhYi5zZWN0aW9ucztcclxuICAgICAgfVxyXG4gICAgICBwdWJsaWMgZ2V0IFRhYigpOiBYcm0uQ29udHJvbHMuVGFiIHtcclxuICAgICAgICByZXR1cm4gKHRoaXMuX3RhYiA/Pz1cclxuICAgICAgICAgIEZvcm0uZm9ybUNvbnRleHQudWkudGFicy5nZXQodGhpcy5OYW1lKSA/P1xyXG4gICAgICAgICAgWHJtRXgudGhyb3dFcnJvcihcclxuICAgICAgICAgICAgYFRoZSB0YWIgJyR7dGhpcy5OYW1lfScgd2FzIG5vdCBmb3VuZCBvbiB0aGUgZm9ybS5gXHJcbiAgICAgICAgICApKTtcclxuICAgICAgfVxyXG4gICAgICBhZGRUYWJTdGF0ZUNoYW5nZShoYW5kbGVyOiBYcm0uRXZlbnRzLkNvbnRleHRTZW5zaXRpdmVIYW5kbGVyKTogdm9pZCB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuVGFiLmFkZFRhYlN0YXRlQ2hhbmdlKGhhbmRsZXIpO1xyXG4gICAgICB9XHJcbiAgICAgIGdldERpc3BsYXlTdGF0ZSgpOiBYcm0uRGlzcGxheVN0YXRlIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5UYWIuZ2V0RGlzcGxheVN0YXRlKCk7XHJcbiAgICAgIH1cclxuICAgICAgZ2V0TmFtZSgpOiBzdHJpbmcge1xyXG4gICAgICAgIHJldHVybiB0aGlzLlRhYi5nZXROYW1lKCk7XHJcbiAgICAgIH1cclxuICAgICAgZ2V0UGFyZW50KCk6IFhybS5VaSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuVGFiLmdldFBhcmVudCgpO1xyXG4gICAgICB9XHJcbiAgICAgIHJlbW92ZVRhYlN0YXRlQ2hhbmdlKGhhbmRsZXI6IFhybS5FdmVudHMuQ29udGV4dFNlbnNpdGl2ZUhhbmRsZXIpOiB2b2lkIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5UYWIucmVtb3ZlVGFiU3RhdGVDaGFuZ2UoaGFuZGxlcik7XHJcbiAgICAgIH1cclxuICAgICAgc2V0RGlzcGxheVN0YXRlKGRpc3BsYXlTdGF0ZTogWHJtLkRpc3BsYXlTdGF0ZSk6IHZvaWQge1xyXG4gICAgICAgIHJldHVybiB0aGlzLlRhYi5zZXREaXNwbGF5U3RhdGUoZGlzcGxheVN0YXRlKTtcclxuICAgICAgfVxyXG4gICAgICBzZXRWaXNpYmxlKHZpc2libGU6IGJvb2xlYW4pOiB2b2lkIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5UYWIuc2V0VmlzaWJsZSh2aXNpYmxlKTtcclxuICAgICAgfVxyXG4gICAgICBnZXRWaXNpYmxlKCk6IGJvb2xlYW4ge1xyXG4gICAgICAgIHJldHVybiB0aGlzLlRhYi5nZXRWaXNpYmxlKCk7XHJcbiAgICAgIH1cclxuICAgICAgZ2V0TGFiZWwoKTogc3RyaW5nIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5UYWIuZ2V0TGFiZWwoKTtcclxuICAgICAgfVxyXG4gICAgICBzZXRMYWJlbChsYWJlbDogc3RyaW5nKTogdm9pZCB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuVGFiLnNldExhYmVsKGxhYmVsKTtcclxuICAgICAgfVxyXG4gICAgICBzZXRGb2N1cygpOiB2b2lkIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5UYWIuc2V0Rm9jdXMoKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgZXhwb3J0IGNsYXNzIEdyaWRDb250cm9sIGltcGxlbWVudHMgWHJtLkNvbnRyb2xzLkdyaWRDb250cm9sIHtcclxuICAgICAgcHVibGljIHJlYWRvbmx5IE5hbWUhOiBzdHJpbmc7XHJcbiAgICAgIHByb3RlY3RlZCBfZ3JpZENvbnRyb2w/OiBYcm0uQ29udHJvbHMuR3JpZENvbnRyb2w7XHJcbiAgICAgIGNvbnN0cnVjdG9yKG5hbWU6IHN0cmluZykge1xyXG4gICAgICAgIHRoaXMuTmFtZSA9IG5hbWU7XHJcbiAgICAgIH1cclxuICAgICAgcHVibGljIGdldCBHcmlkQ29udHJvbCgpOiBYcm0uQ29udHJvbHMuR3JpZENvbnRyb2wge1xyXG4gICAgICAgIHJldHVybiAoXHJcbiAgICAgICAgICAodGhpcy5fZ3JpZENvbnRyb2wgPz89XHJcbiAgICAgICAgICAgIEZvcm0uZm9ybUNvbnRleHQuZ2V0Q29udHJvbDxYcm0uQ29udHJvbHMuR3JpZENvbnRyb2w+KHRoaXMuTmFtZSkpID8/XHJcbiAgICAgICAgICBYcm1FeC50aHJvd0Vycm9yKGBUaGUgZ3JpZCAnJHt0aGlzLk5hbWV9JyB3YXMgbm90IGZvdW5kIG9uIHRoZSBmb3JtLmApXHJcbiAgICAgICAgKTtcclxuICAgICAgfVxyXG4gICAgICBwdWJsaWMgZ2V0IEdyaWQoKTogWHJtLkNvbnRyb2xzLkdyaWQge1xyXG4gICAgICAgIHJldHVybiB0aGlzLkdyaWRDb250cm9sLmdldEdyaWQoKTtcclxuICAgICAgfVxyXG4gICAgICBhZGRPbkxvYWQoaGFuZGxlcjogWHJtLkV2ZW50cy5HcmlkQ29udHJvbC5Mb2FkRXZlbnRIYW5kbGVyKTogdm9pZCB7XHJcbiAgICAgICAgdGhpcy5HcmlkQ29udHJvbC5yZW1vdmVPbkxvYWQoaGFuZGxlciBhcyBhbnkpO1xyXG4gICAgICAgIHJldHVybiB0aGlzLkdyaWRDb250cm9sLmFkZE9uTG9hZChoYW5kbGVyKTtcclxuICAgICAgfVxyXG4gICAgICBnZXRDb250ZXh0VHlwZSgpOiBYcm1FbnVtLkdyaWRDb250cm9sQ29udGV4dCB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuR3JpZENvbnRyb2wuZ2V0Q29udGV4dFR5cGUoKTtcclxuICAgICAgfVxyXG4gICAgICBnZXRFbnRpdHlOYW1lKCk6IHN0cmluZyB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuR3JpZENvbnRyb2wuZ2V0RW50aXR5TmFtZSgpO1xyXG4gICAgICB9XHJcbiAgICAgIGdldEZldGNoWG1sKCk6IHN0cmluZyB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuR3JpZENvbnRyb2wuZ2V0RmV0Y2hYbWwoKTtcclxuICAgICAgfVxyXG4gICAgICBnZXRHcmlkKCk6IFhybS5Db250cm9scy5HcmlkIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5HcmlkQ29udHJvbC5nZXRHcmlkKCk7XHJcbiAgICAgIH1cclxuICAgICAgZ2V0UmVsYXRpb25zaGlwKCk6IFhybS5Db250cm9scy5HcmlkUmVsYXRpb25zaGlwIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5HcmlkQ29udHJvbC5nZXRSZWxhdGlvbnNoaXAoKTtcclxuICAgICAgfVxyXG4gICAgICBnZXRVcmwoY2xpZW50PzogWHJtRW51bS5HcmlkQ2xpZW50KTogc3RyaW5nIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5HcmlkQ29udHJvbC5nZXRVcmwoY2xpZW50KTtcclxuICAgICAgfVxyXG4gICAgICBnZXRWaWV3U2VsZWN0b3IoKTogWHJtLkNvbnRyb2xzLlZpZXdTZWxlY3RvciB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuR3JpZENvbnRyb2wuZ2V0Vmlld1NlbGVjdG9yKCk7XHJcbiAgICAgIH1cclxuICAgICAgb3BlblJlbGF0ZWRHcmlkKCk6IHZvaWQge1xyXG4gICAgICAgIHJldHVybiB0aGlzLkdyaWRDb250cm9sLm9wZW5SZWxhdGVkR3JpZCgpO1xyXG4gICAgICB9XHJcbiAgICAgIHJlZnJlc2goKTogdm9pZCB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuR3JpZENvbnRyb2wucmVmcmVzaCgpO1xyXG4gICAgICB9XHJcbiAgICAgIHJlZnJlc2hSaWJib24oKTogdm9pZCB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuR3JpZENvbnRyb2wucmVmcmVzaFJpYmJvbigpO1xyXG4gICAgICB9XHJcbiAgICAgIHJlbW92ZU9uTG9hZChoYW5kbGVyOiAoKSA9PiB2b2lkKTogdm9pZCB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuR3JpZENvbnRyb2wucmVtb3ZlT25Mb2FkKGhhbmRsZXIpO1xyXG4gICAgICB9XHJcbiAgICAgIGdldENvbnRyb2xUeXBlKCk6IHN0cmluZyB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuR3JpZENvbnRyb2wuZ2V0Q29udHJvbFR5cGUoKTtcclxuICAgICAgfVxyXG4gICAgICBnZXROYW1lKCk6IHN0cmluZyB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuR3JpZENvbnRyb2wuZ2V0TmFtZSgpO1xyXG4gICAgICB9XHJcbiAgICAgIGdldFBhcmVudCgpOiBYcm0uQ29udHJvbHMuU2VjdGlvbiB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuR3JpZENvbnRyb2wuZ2V0UGFyZW50KCk7XHJcbiAgICAgIH1cclxuICAgICAgZ2V0TGFiZWwoKTogc3RyaW5nIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5HcmlkQ29udHJvbC5nZXRMYWJlbCgpO1xyXG4gICAgICB9XHJcbiAgICAgIHNldExhYmVsKGxhYmVsOiBzdHJpbmcpOiB2b2lkIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5HcmlkQ29udHJvbC5zZXRMYWJlbChsYWJlbCk7XHJcbiAgICAgIH1cclxuICAgICAgZ2V0VmlzaWJsZSgpOiBib29sZWFuIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5HcmlkQ29udHJvbC5nZXRWaXNpYmxlKCk7XHJcbiAgICAgIH1cclxuICAgICAgc2V0VmlzaWJsZSh2aXNpYmxlOiBib29sZWFuKTogdm9pZCB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuR3JpZENvbnRyb2wuc2V0VmlzaWJsZSh2aXNpYmxlKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH1cclxufVxyXG4iXX0=