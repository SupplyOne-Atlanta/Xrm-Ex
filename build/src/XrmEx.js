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
             * @returns On success, returns a promise object with entityType (string, table name of record) and id (string, GUID id of the record)
             * @see {@link https://learn.microsoft.com/en-us/power-apps/developer/model-driven-apps/clientapi/reference/xrm-webapi/updaterecord}
             */
            async update(data) {
                try {
                    if (!this.Id || !this.EntityType || !data)
                        return null;
                    let record = null;
                    if (isOffline) {
                        record = await Xrm.WebApi.offline.updateRecord(this.EntityType, this.Id, data);
                    }
                    else {
                        record = await Xrm.WebApi.updateRecord(this.EntityType, this.Id, data);
                    }
                    return record;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiWHJtRXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvWHJtRXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsOERBQThEO0FBa0M5RCxJQUFVLEtBQUssQ0ErN0RkO0FBLzdERCxXQUFVLEtBQUs7SUFDYjs7OztPQUlHO0lBQ0gsU0FBZ0IsVUFBVSxDQUFDLFlBQW9CO1FBQzdDLE1BQU0sSUFBSSxLQUFLLENBQUMsWUFBWSxDQUFDLENBQUM7SUFDaEMsQ0FBQztJQUZlLGdCQUFVLGFBRXpCLENBQUE7SUFDRCxTQUFnQixTQUFTO1FBQ3ZCLE9BQU8sR0FBRyxDQUFDLE9BQU8sQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDLE1BQU0sQ0FBQyxTQUFTLEVBQUUsQ0FBQztJQUMzRCxDQUFDO0lBRmUsZUFBUyxZQUV4QixDQUFBO0lBQ0Q7OztPQUdHO0lBQ0gsU0FBZ0IsZUFBZTtRQUM3QixJQUFJO1lBQ0YsTUFBTSxLQUFLLEdBQUcsSUFBSSxLQUFLLEVBQUUsQ0FBQztZQUMxQixNQUFNLFVBQVUsR0FBRyxLQUFLLENBQUMsS0FBSyxFQUFFLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDO1lBQ3ZFLE1BQU0sbUJBQW1CLEdBQ3ZCLFVBQVUsSUFBSSxVQUFVLENBQUMsTUFBTSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUM7WUFDbkUsTUFBTSxpQkFBaUIsR0FDckIsbUJBQW1CLEVBQUUsS0FBSyxDQUFDLG9CQUFvQixDQUFDO2dCQUNoRCxtQkFBbUIsRUFBRSxLQUFLLENBQUMsZUFBZSxDQUFDLENBQUM7WUFDOUMsTUFBTSxZQUFZLEdBQUcsaUJBQWlCLENBQUMsQ0FBQyxDQUFDLGlCQUFpQixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FB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QUFDLFdBQVcsQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUNwQyxDQUFDO1lBQ0QsU0FBUztnQkFDUCxPQUFPLElBQUksQ0FBQyxXQUFXLENBQUMsU0FBUyxFQUFFLENBQUM7WUFDdEMsQ0FBQztZQUNELFFBQVE7Z0JBQ04sT0FBTyxJQUFJLENBQUMsV0FBVyxDQUFDLFFBQVEsRUFBRSxDQUFDO1lBQ3JDLENBQUM7WUFDRCxRQUFRLENBQUMsS0FBYTtnQkFDcEIsT0FBTyxJQUFJLENBQUMsV0FBVyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUMxQyxDQUFDO1lBQ0QsVUFBVTtnQkFDUixPQUFPLElBQUksQ0FBQyxXQUFXLENBQUMsVUFBVSxFQUFFLENBQUM7WUFDdkMsQ0FBQztZQUNELFVBQVUsQ0FBQyxPQUFnQjtnQkFDekIsT0FBTyxJQUFJLENBQUMsV0FBVyxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsQ0FBQztZQUM5QyxDQUFDO1NBQ0Y7UUExRVksaUJBQVcsY0EwRXZCLENBQUE7SUFDSCxDQUFDLEVBbC9CZ0IsS0FBSyxHQUFMLFdBQUssS0FBTCxXQUFLLFFBay9CckI7QUFDSCxDQUFDLEVBLzdEUyxLQUFLLEtBQUwsS0FBSyxRQSs3RGQiLCJzb3VyY2VzQ29udGVudCI6WyIvLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi4vbm9kZV9tb2R1bGVzL0B0eXBlcy94cm0vaW5kZXguZC50c1wiIC8+XHJcbi8qKlxyXG4gKiBSZXByZXNlbnRzIGEgcGFyYW1ldGVyIGZvciBhIHJlcXVlc3QuXHJcbiAqIEB0eXBlIHtPYmplY3R9IFJlcXVlc3RQYXJhbWV0ZXJcclxuICogQHByb3BlcnR5IHtzdHJpbmd9IE5hbWUgLSBUaGUgbmFtZSBvZiB0aGUgcGFyYW1ldGVyLlxyXG4gKiBAcHJvcGVydHkgeydCb29sZWFuJyB8ICdEYXRlVGltZScgfCAnRGVjaW1hbCcgfCAnRW50aXR5JyB8ICdFbnRpdHlDb2xsZWN0aW9uJyB8ICdFbnRpdHlSZWZlcmVuY2UnIHwgJ0Zsb2F0JyB8ICdJbnRlZ2VyJyB8ICdNb25leScgfCAnUGlja2xpc3QnIHwgJ1N0cmluZyd9IFR5cGUgLSBUaGUgdHlwZSBvZiB0aGUgcGFyYW1ldGVyLlxyXG4gKiBAcHJvcGVydHkgeyp9IFZhbHVlIC0gVGhlIHZhbHVlIG9mIHRoZSBwYXJhbWV0ZXIuXHJcbiAqL1xyXG50eXBlIFJlcXVlc3RQYXJhbWV0ZXIgPSB7XHJcbiAgTmFtZTogc3RyaW5nO1xyXG4gIFR5cGU6XHJcbiAgICB8IFwiQm9vbGVhblwiXHJcbiAgICB8IFwiRGF0ZVRpbWVcIlxyXG4gICAgfCBcIkRlY2ltYWxcIlxyXG4gICAgfCBcIkVudGl0eVwiXHJcbiAgICB8IFwiRW50aXR5Q29sbGVjdGlvblwiXHJcbiAgICB8IFwiRW50aXR5UmVmZXJlbmNlXCJcclxuICAgIHwgXCJGbG9hdFwiXHJcbiAgICB8IFwiSW50ZWdlclwiXHJcbiAgICB8IFwiTW9uZXlcIlxyXG4gICAgfCBcIlBpY2tsaXN0XCJcclxuICAgIHwgXCJTdHJpbmdcIjtcclxuICBWYWx1ZTogYW55O1xyXG59O1xyXG4vKipcclxuICogUmVwcmVzZW50cyBhIHJlZmVyZW5jZSB0byBhbiBlbnRpdHkuXHJcbiAqIEB0eXBlXHJcbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBpZCAtIFRoZSBJRCBvZiB0aGUgZW50aXR5LlxyXG4gKiBAcHJvcGVydHkge3N0cmluZ30gZW50aXR5VHlwZSAtIFRoZSB0eXBlIG9mIHRoZSBlbnRpdHkuXHJcbiAqL1xyXG50eXBlIEVudGl0eVJlZmVyZW5jZSA9IHtcclxuICBpZDogc3RyaW5nO1xyXG4gIGVudGl0eVR5cGU6IHN0cmluZztcclxufTtcclxubmFtZXNwYWNlIFhybUV4IHtcclxuICAvKipcclxuICAgKiBUaHJvd3MgYW4gZXJyb3Igd2l0aCB0aGUgZ2l2ZW4gZXJyb3IgbWVzc2FnZS5cclxuICAgKiBAcGFyYW0ge3N0cmluZ30gZXJyb3JNZXNzYWdlIC0gVGhlIGVycm9yIG1lc3NhZ2UgdG8gdGhyb3cuXHJcbiAgICogQHRocm93cyB7RXJyb3J9IC0gQWx3YXlzIHRocm93cyBhbiBlcnJvciB3aXRoIHRoZSBnaXZlbiBlcnJvciBtZXNzYWdlLlxyXG4gICAqL1xyXG4gIGV4cG9ydCBmdW5jdGlvbiB0aHJvd0Vycm9yKGVycm9yTWVzc2FnZTogc3RyaW5nKTogbmV2ZXIge1xyXG4gICAgdGhyb3cgbmV3IEVycm9yKGVycm9yTWVzc2FnZSk7XHJcbiAgfVxyXG4gIGV4cG9ydCBmdW5jdGlvbiBpc09mZmxpbmUoKTogYm9vbGVhbiB7XHJcbiAgICByZXR1cm4gWHJtLlV0aWxpdHkuZ2V0R2xvYmFsQ29udGV4dCgpLmNsaWVudC5pc09mZmxpbmUoKTtcclxuICB9XHJcbiAgLyoqXHJcbiAgICogUmV0dXJucyB0aGUgbmFtZSBvZiB0aGUgY2FsbGluZyBmdW5jdGlvbi5cclxuICAgKiBAcmV0dXJucyB7c3RyaW5nfSAtIFRoZSBuYW1lIG9mIHRoZSBjYWxsaW5nIGZ1bmN0aW9uLlxyXG4gICAqL1xyXG4gIGV4cG9ydCBmdW5jdGlvbiBnZXRGdW5jdGlvbk5hbWUoKTogc3RyaW5nIHtcclxuICAgIHRyeSB7XHJcbiAgICAgIGNvbnN0IGVycm9yID0gbmV3IEVycm9yKCk7XHJcbiAgICAgIGNvbnN0IHN0YWNrVHJhY2UgPSBlcnJvci5zdGFjaz8uc3BsaXQoXCJcXG5cIikubWFwKChsaW5lKSA9PiBsaW5lLnRyaW0oKSk7XHJcbiAgICAgIGNvbnN0IGNhbGxpbmdGdW5jdGlvbkxpbmUgPVxyXG4gICAgICAgIHN0YWNrVHJhY2UgJiYgc3RhY2tUcmFjZS5sZW5ndGggPj0gMyA/IHN0YWNrVHJhY2VbMl0gOiB1bmRlZmluZWQ7XHJcbiAgICAgIGNvbnN0IGZ1bmN0aW9uTmFtZU1hdGNoID1cclxuICAgICAgICBjYWxsaW5nRnVuY3Rpb25MaW5lPy5tYXRjaCgvYXRcXHMrKFteXFxzXSspXFxzK1xcKC8pIHx8XHJcbiAgICAgICAgY2FsbGluZ0Z1bmN0aW9uTGluZT8ubWF0Y2goL2F0XFxzKyhbXlxcc10rKS8pO1xyXG4gICAgICBjb25zdCBmdW5jdGlvbk5hbWUgPSBmdW5jdGlvbk5hbWVNYXRjaCA/IGZ1bmN0aW9uTmFtZU1hdGNoWzFdIDogXCJcIjtcclxuXHJcbiAgICAgIHJldHVybiBmdW5jdGlvbk5hbWU7XHJcbiAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XHJcbiAgICAgIHRocm93IG5ldyBFcnJvcihgWHJtRXguZ2V0RnVuY3Rpb25OYW1lOlxcbiR7ZXJyb3IubWVzc2FnZX1gKTtcclxuICAgIH1cclxuICB9XHJcbiAgLyoqXHJcbiAgICogRGlzcGxheXMgYSBub3RpZmljYXRpb24gZm9yIGFuIGFwcCB3aXRoIHRoZSBnaXZlbiBtZXNzYWdlIGFuZCBsZXZlbCwgYW5kIGxldHMgeW91IHNwZWNpZnkgd2hldGhlciB0byBzaG93IGEgY2xvc2UgYnV0dG9uLlxyXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBtZXNzYWdlIC0gVGhlIG1lc3NhZ2UgdG8gZGlzcGxheSBpbiB0aGUgbm90aWZpY2F0aW9uLlxyXG4gICAqIEBwYXJhbSB7J1NVQ0NFU1MnIHwgJ0VSUk9SJyB8ICdXQVJOSU5HJyB8ICdJTkZPJ30gbGV2ZWwgLSBUaGUgbGV2ZWwgb2YgdGhlIG5vdGlmaWNhdGlvbi4gQ2FuIGJlICdTVUNDRVNTJywgJ0VSUk9SJywgJ1dBUk5JTkcnLCBvciAnSU5GTycuXHJcbiAgICogQHBhcmFtIHtib29sZWFufSBbc2hvd0Nsb3NlQnV0dG9uPWZhbHNlXSAtIFdoZXRoZXIgdG8gc2hvdyBhIGNsb3NlIGJ1dHRvbiBvbiB0aGUgbm90aWZpY2F0aW9uLiBEZWZhdWx0cyB0byBmYWxzZS5cclxuICAgKiBAcmV0dXJucyB7UHJvbWlzZTxzdHJpbmc+fSAtIEEgcHJvbWlzZSB0aGF0IHJlc29sdmVzIHdpdGggdGhlIElEIG9mIHRoZSBjcmVhdGVkIG5vdGlmaWNhdGlvbi5cclxuICAgKi9cclxuICBleHBvcnQgYXN5bmMgZnVuY3Rpb24gYWRkR2xvYmFsTm90aWZpY2F0aW9uKFxyXG4gICAgbWVzc2FnZTogc3RyaW5nLFxyXG4gICAgbGV2ZWw6IFwiU1VDQ0VTU1wiIHwgXCJFUlJPUlwiIHwgXCJXQVJOSU5HXCIgfCBcIklORk9cIixcclxuICAgIHNob3dDbG9zZUJ1dHRvbiA9IGZhbHNlXHJcbiAgKTogUHJvbWlzZTxzdHJpbmc+IHtcclxuICAgIGNvbnN0IGxldmVsTWFwID0ge1xyXG4gICAgICBTVUNDRVNTOiAxLFxyXG4gICAgICBFUlJPUjogMixcclxuICAgICAgV0FSTklORzogMyxcclxuICAgICAgSU5GTzogNCxcclxuICAgIH07XHJcbiAgICBjb25zdCBtZXNzYWdlTGV2ZWwgPSBsZXZlbE1hcFtsZXZlbF0gfHwgbGV2ZWxNYXAuSU5GTztcclxuICAgIGNvbnN0IG5vdGlmaWNhdGlvbiA9IHtcclxuICAgICAgdHlwZTogMixcclxuICAgICAgbGV2ZWw6IG1lc3NhZ2VMZXZlbCxcclxuICAgICAgbWVzc2FnZSxcclxuICAgICAgc2hvd0Nsb3NlQnV0dG9uLFxyXG4gICAgfTtcclxuICAgIHRyeSB7XHJcbiAgICAgIHJldHVybiBhd2FpdCBYcm0uQXBwLmFkZEdsb2JhbE5vdGlmaWNhdGlvbihub3RpZmljYXRpb24pO1xyXG4gICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFhybUV4LiR7Z2V0RnVuY3Rpb25OYW1lKCl9OlxcbiR7ZXJyb3IubWVzc2FnZX1gKTtcclxuICAgIH1cclxuICB9XHJcbiAgLyoqXHJcbiAgICogQ2xlYXJzIGEgbm90aWZpY2F0aW9uIGluIHRoZSBhcHAgd2l0aCB0aGUgZ2l2ZW4gdW5pcXVlIElELlxyXG4gICAqIEBwYXJhbSB7c3RyaW5nfSB1bmlxdWVJZCAtIFRoZSB1bmlxdWUgSUQgb2YgdGhlIG5vdGlmaWNhdGlvbiB0byBjbGVhci5cclxuICAgKiBAcmV0dXJucyB7UHJvbWlzZTxzdHJpbmc+fSAtIEEgcHJvbWlzZSB0aGF0IHJlc29sdmVzIHdoZW4gdGhlIG5vdGlmaWNhdGlvbiBoYXMgYmVlbiBjbGVhcmVkLlxyXG4gICAqL1xyXG4gIGV4cG9ydCBhc3luYyBmdW5jdGlvbiByZW1vdmVHbG9iYWxOb3RpZmljYXRpb24oXHJcbiAgICB1bmlxdWVJZDogc3RyaW5nXHJcbiAgKTogUHJvbWlzZTxzdHJpbmc+IHtcclxuICAgIHRyeSB7XHJcbiAgICAgIHJldHVybiBhd2FpdCBYcm0uQXBwLmNsZWFyR2xvYmFsTm90aWZpY2F0aW9uKHVuaXF1ZUlkKTtcclxuICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcclxuICAgICAgdGhyb3cgbmV3IEVycm9yKGBYcm1FeC4ke2dldEZ1bmN0aW9uTmFtZSgpfTpcXG4ke2Vycm9yLm1lc3NhZ2V9YCk7XHJcbiAgICB9XHJcbiAgfVxyXG4gIC8qKlxyXG4gICAqIFJldHJpZXZlcyB0aGUgdmFsdWUgb2YgYW4gZW52aXJvbm1lbnQgdmFyaWFibGUgYnkgdXNpbmcgaXRzIHNjaGVtYSBuYW1lIGFzIGtleS5cclxuICAgKiBJZiB0aGUgZW52aXJvbm1lbnQgdmFyaWFibGUgaGFzIGJvdGggYSBkZWZhdWx0IHZhbHVlIGFuZCBhIGN1cnJlbnQgdmFsdWUsIHRoaXMgZnVuY3Rpb24gd2lsbCByZXRyaWV2ZSB0aGUgY3VycmVudCB2YWx1ZS5cclxuICAgKiBAcGFyYW0ge3N0cmluZ30gZW52aXJvbm1lbnRWYXJpYWJsZVNjaGVtYU5hbWUgLSBUaGUgc2NoZW1hIG5hbWUgb2YgdGhlIGVudmlyb25tZW50IHZhcmlhYmxlIHRvIHJldHJpZXZlLlxyXG4gICAqIEByZXR1cm5zIHtQcm9taXNlPHN0cmluZz59IC0gQSBwcm9taXNlIHRoYXQgcmVzb2x2ZXMgd2l0aCB0aGUgdmFsdWUgb2YgdGhlIGVudmlyb25tZW50IHZhcmlhYmxlLlxyXG4gICAqIEBhc3luY1xyXG4gICAqL1xyXG4gIGV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXRFbnZpcm9ubWVudFZhcmlhYmxlVmFsdWUoXHJcbiAgICBlbnZpcm9ubWVudFZhcmlhYmxlU2NoZW1hTmFtZTogc3RyaW5nXHJcbiAgKTogUHJvbWlzZTxzdHJpbmc+IHtcclxuICAgIGxldCByZXNwb25zZSA9IGF3YWl0IGV4ZWN1dGVGdW5jdGlvbihcIlJldHJpZXZlRW52aXJvbm1lbnRWYXJpYWJsZVZhbHVlXCIsIFtcclxuICAgICAge1xyXG4gICAgICAgIE5hbWU6IFwiRGVmaW5pdGlvblNjaGVtYU5hbWVcIixcclxuICAgICAgICBUeXBlOiBcIlN0cmluZ1wiLFxyXG4gICAgICAgIFZhbHVlOiBlbnZpcm9ubWVudFZhcmlhYmxlU2NoZW1hTmFtZSxcclxuICAgICAgfSxcclxuICAgIF0pO1xyXG4gICAgcmV0dXJuIE9iamVjdC5oYXNPd24ocmVzcG9uc2UsIFwiVmFsdWVcIikgPyByZXNwb25zZS5WYWx1ZSA6IHJlc3BvbnNlO1xyXG4gIH1cclxuICAvKipcclxuICAgKiBBIG1hcCBvZiBDUk0gZGF0YSB0eXBlcyB0byB0aGVpciBjb3JyZXNwb25kaW5nIHR5cGUgbmFtZXMsIHN0cnVjdHVyYWwgcHJvcGVydGllcywgYW5kIEphdmFTY3JpcHQgdHlwZXMuXHJcbiAgICogQHR5cGUge09iamVjdC48c3RyaW5nLCB7IHR5cGVOYW1lOiBzdHJpbmcsIHN0cnVjdHVyYWxQcm9wZXJ0eTogbnVtYmVyLCBqc1R5cGU6IHN0cmluZyB9Pn1cclxuICAgKi9cclxuICBsZXQgdHlwZU1hcCA9IHtcclxuICAgIFN0cmluZzogeyB0eXBlTmFtZTogXCJFZG0uU3RyaW5nXCIsIHN0cnVjdHVyYWxQcm9wZXJ0eTogMSwganNUeXBlOiBcInN0cmluZ1wiIH0sXHJcbiAgICBJbnRlZ2VyOiB7IHR5cGVOYW1lOiBcIkVkbS5JbnQzMlwiLCBzdHJ1Y3R1cmFsUHJvcGVydHk6IDEsIGpzVHlwZTogXCJudW1iZXJcIiB9LFxyXG4gICAgQm9vbGVhbjoge1xyXG4gICAgICB0eXBlTmFtZTogXCJFZG0uQm9vbGVhblwiLFxyXG4gICAgICBzdHJ1Y3R1cmFsUHJvcGVydHk6IDEsXHJcbiAgICAgIGpzVHlwZTogXCJib29sZWFuXCIsXHJcbiAgICB9LFxyXG4gICAgRGF0ZVRpbWU6IHtcclxuICAgICAgdHlwZU5hbWU6IFwiRWRtLkRhdGVUaW1lT2Zmc2V0XCIsXHJcbiAgICAgIHN0cnVjdHVyYWxQcm9wZXJ0eTogMSxcclxuICAgICAganNUeXBlOiBcIm9iamVjdFwiLFxyXG4gICAgfSxcclxuICAgIEVudGl0eVJlZmVyZW5jZToge1xyXG4gICAgICB0eXBlTmFtZTogXCJtc2NybS5jcm1iYXNlZW50aXR5XCIsXHJcbiAgICAgIHN0cnVjdHVyYWxQcm9wZXJ0eTogNSxcclxuICAgICAganNUeXBlOiBcIm9iamVjdFwiLFxyXG4gICAgfSxcclxuICAgIERlY2ltYWw6IHtcclxuICAgICAgdHlwZU5hbWU6IFwiRWRtLkRlY2ltYWxcIixcclxuICAgICAgc3RydWN0dXJhbFByb3BlcnR5OiAxLFxyXG4gICAgICBqc1R5cGU6IFwibnVtYmVyXCIsXHJcbiAgICB9LFxyXG4gICAgRW50aXR5OiB7XHJcbiAgICAgIHR5cGVOYW1lOiBcIm1zY3JtLmNybWJhc2VlbnRpdHlcIixcclxuICAgICAgc3RydWN0dXJhbFByb3BlcnR5OiA1LFxyXG4gICAgICBqc1R5cGU6IFwib2JqZWN0XCIsXHJcbiAgICB9LFxyXG4gICAgRW50aXR5Q29sbGVjdGlvbjoge1xyXG4gICAgICB0eXBlTmFtZTogXCJDb2xsZWN0aW9uKG1zY3JtLmNybWJhc2VlbnRpdHkpXCIsXHJcbiAgICAgIHN0cnVjdHVyYWxQcm9wZXJ0eTogNCxcclxuICAgICAganNUeXBlOiBcIm9iamVjdFwiLFxyXG4gICAgfSxcclxuICAgIEZsb2F0OiB7IHR5cGVOYW1lOiBcIkVkbS5Eb3VibGVcIiwgc3RydWN0dXJhbFByb3BlcnR5OiAxLCBqc1R5cGU6IFwibnVtYmVyXCIgfSxcclxuICAgIE1vbmV5OiB7IHR5cGVOYW1lOiBcIkVkbS5EZWNpbWFsXCIsIHN0cnVjdHVyYWxQcm9wZXJ0eTogMSwganNUeXBlOiBcIm51bWJlclwiIH0sXHJcbiAgICBQaWNrbGlzdDoge1xyXG4gICAgICB0eXBlTmFtZTogXCJFZG0uSW50MzJcIixcclxuICAgICAgc3RydWN0dXJhbFByb3BlcnR5OiAxLFxyXG4gICAgICBqc1R5cGU6IFwibnVtYmVyXCIsXHJcbiAgICB9LFxyXG4gIH07XHJcbiAgLyoqXHJcbiAgICogQ2hlY2tzIGlmIHRoZSBnaXZlbiByZXF1ZXN0IHBhcmFtZXRlciBpcyBvZiBhIHN1cHBvcnRlZCB0eXBlIGFuZCBoYXMgYSB2YWxpZCB2YWx1ZS5cclxuICAgKiBAcGFyYW0ge1JlcXVlc3RQYXJhbWV0ZXJ9IHJlcXVlc3RQYXJhbWV0ZXIgLSBUaGUgcmVxdWVzdCBwYXJhbWV0ZXIgdG8gY2hlY2suXHJcbiAgICogQHJldHVybnMge3ZvaWR9XHJcbiAgICogQHRocm93cyB7RXJyb3J9IC0gVGhyb3dzIGFuIGVycm9yIGlmIHRoZSByZXF1ZXN0IHBhcmFtZXRlciBpcyBub3Qgb2YgYSBzdXBwb3J0ZWQgdHlwZSBvciBoYXMgYW4gaW52YWxpZCB2YWx1ZS5cclxuICAgKi9cclxuICBleHBvcnQgZnVuY3Rpb24gY2hlY2tSZXF1ZXN0UGFyYW1ldGVyVHlwZShcclxuICAgIHJlcXVlc3RQYXJhbWV0ZXI6IFJlcXVlc3RQYXJhbWV0ZXJcclxuICApOiB2b2lkIHtcclxuICAgIGlmICghdHlwZU1hcFtyZXF1ZXN0UGFyYW1ldGVyLlR5cGVdKVxyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXHJcbiAgICAgICAgYFRoZSBwcm9wZXJ0eSB0eXBlICR7cmVxdWVzdFBhcmFtZXRlci5UeXBlfSBvZiB0aGUgcHJvcGVydHkgJHtyZXF1ZXN0UGFyYW1ldGVyLk5hbWV9IGlzIG5vdCBzdXBwb3J0ZWQuYFxyXG4gICAgICApO1xyXG4gICAgY29uc3QgZXhwZWN0ZWRUeXBlID0gdHlwZU1hcFtyZXF1ZXN0UGFyYW1ldGVyLlR5cGVdLmpzVHlwZTtcclxuICAgIGNvbnN0IGFjdHVhbFR5cGUgPSB0eXBlb2YgcmVxdWVzdFBhcmFtZXRlci5WYWx1ZTtcclxuICAgIGNvbnN0IGludmFsaWRUeXBlTWVzc2FnZSA9IGBUaGUgdmFsdWUgJHtyZXF1ZXN0UGFyYW1ldGVyLlZhbHVlfVxcbm9mIHRoZSBwcm9wZXJ0eSAke3JlcXVlc3RQYXJhbWV0ZXIuTmFtZX1cXG5pcyBub3Qgb2YgdGhlIGV4cGVjdGVkIHR5cGUgJHtyZXF1ZXN0UGFyYW1ldGVyLlR5cGV9LmA7XHJcbiAgICBpZiAoXHJcbiAgICAgIHJlcXVlc3RQYXJhbWV0ZXIuVHlwZSA9PT0gXCJFbnRpdHlSZWZlcmVuY2VcIiB8fFxyXG4gICAgICByZXF1ZXN0UGFyYW1ldGVyLlR5cGUgPT09IFwiRW50aXR5XCJcclxuICAgICkge1xyXG4gICAgICBpZiAoXHJcbiAgICAgICAgIXJlcXVlc3RQYXJhbWV0ZXIuVmFsdWUgfHxcclxuICAgICAgICAhcmVxdWVzdFBhcmFtZXRlci5WYWx1ZS5oYXNPd25Qcm9wZXJ0eShcImlkXCIpIHx8XHJcbiAgICAgICAgIXJlcXVlc3RQYXJhbWV0ZXIuVmFsdWUuaGFzT3duUHJvcGVydHkoXCJlbnRpdHlUeXBlXCIpXHJcbiAgICAgICkge1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihpbnZhbGlkVHlwZU1lc3NhZ2UpO1xyXG4gICAgICB9XHJcbiAgICAgIHR5cGVNYXBbXHJcbiAgICAgICAgcmVxdWVzdFBhcmFtZXRlci5UeXBlXHJcbiAgICAgIF0udHlwZU5hbWUgPSBgbXNjcm0uJHtyZXF1ZXN0UGFyYW1ldGVyLlZhbHVlLmVudGl0eVR5cGV9YDtcclxuICAgIH0gZWxzZSBpZiAocmVxdWVzdFBhcmFtZXRlci5UeXBlID09PSBcIkVudGl0eUNvbGxlY3Rpb25cIikge1xyXG4gICAgICBpZiAoXHJcbiAgICAgICAgIUFycmF5LmlzQXJyYXkocmVxdWVzdFBhcmFtZXRlci5WYWx1ZSkgfHxcclxuICAgICAgICByZXF1ZXN0UGFyYW1ldGVyLlZhbHVlLmV2ZXJ5KFxyXG4gICAgICAgICAgKHYpID0+XHJcbiAgICAgICAgICAgIHR5cGVvZiB2ICE9PSBcIm9iamVjdFwiIHx8XHJcbiAgICAgICAgICAgICF2IHx8XHJcbiAgICAgICAgICAgICF2Lmhhc093blByb3BlcnR5KFwiaWRcIikgfHxcclxuICAgICAgICAgICAgIXYuaGFzT3duUHJvcGVydHkoXCJlbnRpdHlUeXBlXCIpXHJcbiAgICAgICAgKVxyXG4gICAgICApIHtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoaW52YWxpZFR5cGVNZXNzYWdlKTtcclxuICAgICAgfVxyXG4gICAgfSBlbHNlIGlmIChyZXF1ZXN0UGFyYW1ldGVyLlR5cGUgPT09IFwiRGF0ZVRpbWVcIikge1xyXG4gICAgICBpZiAoIShyZXF1ZXN0UGFyYW1ldGVyLlZhbHVlIGluc3RhbmNlb2YgRGF0ZSkpIHtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoaW52YWxpZFR5cGVNZXNzYWdlKTtcclxuICAgICAgfVxyXG4gICAgfSBlbHNlIHtcclxuICAgICAgaWYgKGFjdHVhbFR5cGUgIT09IGV4cGVjdGVkVHlwZSkge1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihpbnZhbGlkVHlwZU1lc3NhZ2UpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfVxyXG4gIC8qKlxyXG4gICAqIEV4ZWN1dGVzIGFuIEFjdGlvbi5cclxuICAgKiBAcGFyYW0ge3N0cmluZ30gYWN0aW9uTmFtZSAtIFRoZSB1bmlxdWUgbmFtZSBvZiB0aGUgYWN0aW9uLlxyXG4gICAqIEBwYXJhbSB7UmVxdWVzdFBhcmFtZXRlcltdfSByZXF1ZXN0UGFyYW1ldGVycyAtIEFuIGFycmF5IG9mIG9iamVjdHMgd2l0aCB0aGUgcGFyYW1ldGVyIG5hbWUsIHR5cGUgYW5kIHZhbHVlLlxyXG4gICAqIEBwYXJhbSB7RW50aXR5UmVmZXJlbmNlfSBbYm91bmRFbnRpdHldIC0gQW4gb3B0aW9uYWwgRW50aXR5UmVmZXJlbmNlIG9mIHRoZSBib3VuZCBlbnRpdHkuXHJcbiAgICogQHJldHVybnMge1Byb21pc2U8YW55Pn0gLSBBIFByb21pc2Ugd2l0aCB0aGUgcmVxdWVzdCByZXNwb25zZS5cclxuICAgKiBAdGhyb3dzIHtFcnJvcn0gLSBUaHJvd3MgYW4gZXJyb3IgaWYgdGhlIHJlcXVlc3QgcGFyYW1ldGVyIGlzIG5vdCBvZiBhIHN1cHBvcnRlZCB0eXBlIG9yIGhhcyBhbiBpbnZhbGlkIHZhbHVlLlxyXG4gICAqL1xyXG4gIGV4cG9ydCBhc3luYyBmdW5jdGlvbiBleGVjdXRlQWN0aW9uKFxyXG4gICAgYWN0aW9uTmFtZTogc3RyaW5nLFxyXG4gICAgcmVxdWVzdFBhcmFtZXRlcnM6IFJlcXVlc3RQYXJhbWV0ZXJbXSxcclxuICAgIGJvdW5kRW50aXR5PzogRW50aXR5UmVmZXJlbmNlXHJcbiAgKTogUHJvbWlzZTxhbnk+IHtcclxuICAgIGNvbnN0IHBhcmFtZXRlckRlZmluaXRpb246IGFueSA9IHt9O1xyXG4gICAgaWYgKGJvdW5kRW50aXR5KVxyXG4gICAgICByZXF1ZXN0UGFyYW1ldGVycy5wdXNoKHtcclxuICAgICAgICBOYW1lOiBcImVudGl0eVwiLFxyXG4gICAgICAgIFZhbHVlOiBib3VuZEVudGl0eSxcclxuICAgICAgICBUeXBlOiBcIkVudGl0eVJlZmVyZW5jZVwiLFxyXG4gICAgICB9KTtcclxuICAgIGZvciAoY29uc3QgcmVxdWVzdFBhcmFtZXRlciBvZiByZXF1ZXN0UGFyYW1ldGVycykge1xyXG4gICAgICBjaGVja1JlcXVlc3RQYXJhbWV0ZXJUeXBlKHJlcXVlc3RQYXJhbWV0ZXIpO1xyXG4gICAgICBwYXJhbWV0ZXJEZWZpbml0aW9uW3JlcXVlc3RQYXJhbWV0ZXIuTmFtZV0gPSB7XHJcbiAgICAgICAgdHlwZU5hbWU6IHR5cGVNYXBbcmVxdWVzdFBhcmFtZXRlci5UeXBlXS50eXBlTmFtZSxcclxuICAgICAgICBzdHJ1Y3R1cmFsUHJvcGVydHk6IHR5cGVNYXBbcmVxdWVzdFBhcmFtZXRlci5UeXBlXS5zdHJ1Y3R1cmFsUHJvcGVydHksXHJcbiAgICAgIH07XHJcbiAgICB9XHJcbiAgICBjb25zdCByZXEgPSBPYmplY3QuYXNzaWduKFxyXG4gICAgICB7XHJcbiAgICAgICAgZ2V0TWV0YWRhdGE6ICgpID0+ICh7XHJcbiAgICAgICAgICBib3VuZFBhcmFtZXRlcjogYm91bmRFbnRpdHkgPyBcImVudGl0eVwiIDogbnVsbCxcclxuICAgICAgICAgIG9wZXJhdGlvblR5cGU6IDAsXHJcbiAgICAgICAgICBvcGVyYXRpb25OYW1lOiBhY3Rpb25OYW1lLFxyXG4gICAgICAgICAgcGFyYW1ldGVyVHlwZXM6IHBhcmFtZXRlckRlZmluaXRpb24sXHJcbiAgICAgICAgfSksXHJcbiAgICAgIH0sXHJcbiAgICAgIC4uLnJlcXVlc3RQYXJhbWV0ZXJzLm1hcCgocCkgPT4gKHsgW3AuTmFtZV06IHAuVmFsdWUgfSkpXHJcbiAgICApO1xyXG4gICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBYcm0uV2ViQXBpLm9ubGluZS5leGVjdXRlKHJlcSk7XHJcbiAgICBpZiAocmVzcG9uc2Uub2spIHJldHVybiByZXNwb25zZS5qc29uKCkuY2F0Y2goKCkgPT4gcmVzcG9uc2UpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogRXhlY3V0ZXMgYSBGdW5jdGlvbi5cclxuICAgKiBAcGFyYW0ge3N0cmluZ30gZnVuY3Rpb25OYW1lIC0gVGhlIHVuaXF1ZSBuYW1lIG9mIHRoZSBmdW5jdGlvbi5cclxuICAgKiBAcGFyYW0ge1JlcXVlc3RQYXJhbWV0ZXJbXX0gcmVxdWVzdFBhcmFtZXRlcnMgLSBBbiBhcnJheSBvZiBvYmplY3RzIHdpdGggdGhlIHBhcmFtZXRlciBuYW1lLCB0eXBlIGFuZCB2YWx1ZS5cclxuICAgKiBAcGFyYW0ge0VudGl0eVJlZmVyZW5jZX0gW2JvdW5kRW50aXR5XSAtIEFuIG9wdGlvbmFsIEVudGl0eVJlZmVyZW5jZSBvZiB0aGUgYm91bmQgZW50aXR5LlxyXG4gICAqIEByZXR1cm5zIHtQcm9taXNlPGFueT59IC0gQSBQcm9taXNlIHdpdGggdGhlIHJlcXVlc3QgcmVzcG9uc2UuXHJcbiAgICogQHRocm93cyB7RXJyb3J9IC0gVGhyb3dzIGFuIGVycm9yIGlmIHRoZSByZXF1ZXN0IHBhcmFtZXRlciBpcyBub3Qgb2YgYSBzdXBwb3J0ZWQgdHlwZSBvciBoYXMgYW4gaW52YWxpZCB2YWx1ZS5cclxuICAgKi9cclxuICBleHBvcnQgYXN5bmMgZnVuY3Rpb24gZXhlY3V0ZUZ1bmN0aW9uKFxyXG4gICAgZnVuY3Rpb25OYW1lOiBzdHJpbmcsXHJcbiAgICByZXF1ZXN0UGFyYW1ldGVyczogUmVxdWVzdFBhcmFtZXRlcltdLFxyXG4gICAgYm91bmRFbnRpdHk/OiBFbnRpdHlSZWZlcmVuY2VcclxuICApOiBQcm9taXNlPGFueT4ge1xyXG4gICAgY29uc3QgcGFyYW1ldGVyRGVmaW5pdGlvbjogYW55ID0ge307XHJcbiAgICBpZiAoYm91bmRFbnRpdHkpXHJcbiAgICAgIHJlcXVlc3RQYXJhbWV0ZXJzLnB1c2goe1xyXG4gICAgICAgIE5hbWU6IFwiZW50aXR5XCIsXHJcbiAgICAgICAgVmFsdWU6IGJvdW5kRW50aXR5LFxyXG4gICAgICAgIFR5cGU6IFwiRW50aXR5UmVmZXJlbmNlXCIsXHJcbiAgICAgIH0pO1xyXG4gICAgZm9yIChjb25zdCByZXF1ZXN0UGFyYW1ldGVyIG9mIHJlcXVlc3RQYXJhbWV0ZXJzKSB7XHJcbiAgICAgIGNoZWNrUmVxdWVzdFBhcmFtZXRlclR5cGUocmVxdWVzdFBhcmFtZXRlcik7XHJcbiAgICAgIHBhcmFtZXRlckRlZmluaXRpb25bcmVxdWVzdFBhcmFtZXRlci5OYW1lXSA9IHtcclxuICAgICAgICB0eXBlTmFtZTogdHlwZU1hcFtyZXF1ZXN0UGFyYW1ldGVyLlR5cGVdLnR5cGVOYW1lLFxyXG4gICAgICAgIHN0cnVjdHVyYWxQcm9wZXJ0eTogdHlwZU1hcFtyZXF1ZXN0UGFyYW1ldGVyLlR5cGVdLnN0cnVjdHVyYWxQcm9wZXJ0eSxcclxuICAgICAgfTtcclxuICAgIH1cclxuICAgIGNvbnN0IHJlcSA9IE9iamVjdC5hc3NpZ24oXHJcbiAgICAgIHtcclxuICAgICAgICBnZXRNZXRhZGF0YTogKCkgPT4gKHtcclxuICAgICAgICAgIGJvdW5kUGFyYW1ldGVyOiBib3VuZEVudGl0eSA/IFwiZW50aXR5XCIgOiBudWxsLFxyXG4gICAgICAgICAgb3BlcmF0aW9uVHlwZTogMSxcclxuICAgICAgICAgIG9wZXJhdGlvbk5hbWU6IGZ1bmN0aW9uTmFtZSxcclxuICAgICAgICAgIHBhcmFtZXRlclR5cGVzOiBwYXJhbWV0ZXJEZWZpbml0aW9uLFxyXG4gICAgICAgIH0pLFxyXG4gICAgICB9LFxyXG4gICAgICAuLi5yZXF1ZXN0UGFyYW1ldGVycy5tYXAoKHApID0+ICh7IFtwLk5hbWVdOiBwLlZhbHVlIH0pKVxyXG4gICAgKTtcclxuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgWHJtLldlYkFwaS5vbmxpbmUuZXhlY3V0ZShyZXEpO1xyXG4gICAgaWYgKHJlc3BvbnNlLm9rKSByZXR1cm4gcmVzcG9uc2UuanNvbigpLmNhdGNoKCgpID0+IHJlc3BvbnNlKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIE1ha2VzIGEgR1VJRCBsb3dlcmNhc2UgYW5kIHJlbW92ZXMgYnJhY2tldHMuXHJcbiAgICogQHBhcmFtIHtzdHJpbmd9IGd1aWQgLSBUaGUgR1VJRCB0byBub3JtYWxpemUuXHJcbiAgICogQHJldHVybnMge3N0cmluZ30gLSBUaGUgbm9ybWFsaXplZCBHVUlELlxyXG4gICAqL1xyXG4gIGV4cG9ydCBmdW5jdGlvbiBub3JtYWxpemVHdWlkKGd1aWQ6IHN0cmluZyk6IHN0cmluZyB7XHJcbiAgICBpZiAodHlwZW9mIGd1aWQgIT09IFwic3RyaW5nXCIpXHJcbiAgICAgIHRocm93IG5ldyBFcnJvcihgWHJtRXgubm9ybWFsaXplR3VpZDpcXG4nJHtndWlkfScgaXMgbm90IGEgc3RyaW5nYCk7XHJcbiAgICByZXR1cm4gZ3VpZC50b0xvd2VyQ2FzZSgpLnJlcGxhY2UoL1t7fV0vZywgXCJcIik7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBXcmFwcyBhIGZ1bmN0aW9uIHRoYXQgdGFrZXMgYSBjYWxsYmFjayBhcyBpdHMgbGFzdCBwYXJhbWV0ZXIgYW5kIHJldHVybnMgYSBQcm9taXNlLlxyXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGZuIHRoZSBmdW5jdGlvbiB0byB3cmFwXHJcbiAgICogQHBhcmFtIGNvbnRleHQgdGhlIHBhcmVudCBwcm9wZXJ0eSBvZiB0aGUgZnVuY3Rpb24gZi5lLiBmb3JtQ29udGV4dC5kYXRhLnByb2Nlc3MgZm9yIGZvcm1Db250ZXh0LmRhdGEucHJvY2Vzcy5nZXRFbmFibGVkUHJvY2Vzc2VzXHJcbiAgICogQHBhcmFtIGFyZ3MgdGhlIGFyZ3VtZW50cyB0byBwYXNzIHRvIHRoZSBmdW5jdGlvblxyXG4gICAqIEByZXR1cm5zIHtQcm9taXNlPGFueT59IGEgUHJvbWlzZSB0aGF0IHJlc29sdmVzIHdpdGggdGhlIGNhbGxiYWNrIHJlc3BvbnNlXHJcbiAgICovXHJcbiAgZXhwb3J0IGZ1bmN0aW9uIGFzUHJvbWlzZTxUPihmbjogRnVuY3Rpb24sIGNvbnRleHQsIC4uLmFyZ3MpOiBQcm9taXNlPFQ+IHtcclxuICAgIHJldHVybiBuZXcgUHJvbWlzZTxUPigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XHJcbiAgICAgIGNvbnN0IGNhbGxiYWNrID0gKHJlc3BvbnNlOiBUKSA9PiB7XHJcbiAgICAgICAgcmVzb2x2ZShyZXNwb25zZSk7XHJcbiAgICAgIH07XHJcbiAgICAgIHRyeSB7XHJcbiAgICAgICAgLy8gQ2FsbCB0aGUgZnVuY3Rpb24gd2l0aCB0aGUgYXJndW1lbnRzIGFuZCB0aGUgY2FsbGJhY2sgYXQgdGhlIGVuZFxyXG4gICAgICAgIGZuLmNhbGwoY29udGV4dCwgLi4uYXJncywgY2FsbGJhY2spO1xyXG4gICAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICAgIHJlamVjdChlcnJvcik7XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG4gIH1cclxuICAvKipcclxuICAgKiBPcGVucyBhIGRpYWxvZyB3aXRoIGR5bmFtaWMgaGVpZ2h0IGFuZCB3aWR0aCBiYXNlZCBvbiB0ZXh0IGNvbnRlbnQuXHJcbiAgICogQHBhcmFtIHtzdHJpbmd9IHRpdGxlIC0gVGhlIHRpdGxlIG9mIHRoZSBkaWFsb2cuXHJcbiAgICogQHBhcmFtIHtzdHJpbmd9IHRleHQgLSBUaGUgdGV4dCBjb250ZW50IG9mIHRoZSBkaWFsb2cuXHJcbiAgICogQHJldHVybnMge1Byb21pc2U8YW55Pn0gLSBBIFByb21pc2Ugd2l0aCB0aGUgZGlhbG9nIHJlc3BvbnNlLlxyXG4gICAqL1xyXG4gIGV4cG9ydCBhc3luYyBmdW5jdGlvbiBvcGVuQWxlcnREaWFsb2coXHJcbiAgICB0aXRsZTogc3RyaW5nLFxyXG4gICAgdGV4dDogc3RyaW5nXHJcbiAgKTogUHJvbWlzZTxhbnk+IHtcclxuICAgIHRyeSB7XHJcbiAgICAgIGNvbnN0IHJvd3MgPSB0ZXh0LnNwbGl0KC9cXHJcXG58XFxyfFxcbi8pO1xyXG4gICAgICBsZXQgYWRkaXRpb25hbFJvd3MgPSAwO1xyXG4gICAgICByb3dzLmZvckVhY2goKHJvdykgPT4ge1xyXG4gICAgICAgIGxldCB3aWR0aCA9IGdldFRleHRXaWR0aChcclxuICAgICAgICAgIHJvdyxcclxuICAgICAgICAgIFwiMXJlbSBTZWdvZSBVSSBSZWd1bGFyLCBTZWdvZVVJLCBTZWdvZSBVSVwiXHJcbiAgICAgICAgKTtcclxuICAgICAgICBpZiAod2lkdGggPiA5NDApIHtcclxuICAgICAgICAgIGFkZGl0aW9uYWxSb3dzICs9IHdpZHRoIC8gOTQwO1xyXG4gICAgICAgIH1cclxuICAgICAgfSk7XHJcbiAgICAgIGNvbnN0IGxvbmdlc3RSb3cgPSByb3dzLnJlZHVjZShcclxuICAgICAgICAoYWNjLCByb3cpID0+IChyb3cubGVuZ3RoID4gYWNjLmxlbmd0aCA/IHJvdyA6IGFjYyksXHJcbiAgICAgICAgXCJcIlxyXG4gICAgICApO1xyXG4gICAgICBjb25zdCB3aWR0aCA9IE1hdGgubWluKFxyXG4gICAgICAgIGdldFRleHRXaWR0aChsb25nZXN0Um93LCBcIjFyZW0gU2Vnb2UgVUkgUmVndWxhciwgU2Vnb2VVSSwgU2Vnb2UgVUlcIiksXHJcbiAgICAgICAgMTAwMFxyXG4gICAgICApO1xyXG4gICAgICBjb25zdCBoZWlnaHQgPSAxMDkgKyAocm93cy5sZW5ndGggKyBhZGRpdGlvbmFsUm93cykgKiAyMDtcclxuICAgICAgcmV0dXJuIGF3YWl0IFhybS5OYXZpZ2F0aW9uLm9wZW5BbGVydERpYWxvZyhcclxuICAgICAgICB7XHJcbiAgICAgICAgICBjb25maXJtQnV0dG9uTGFiZWw6IFwiT2tcIixcclxuICAgICAgICAgIHRleHQsXHJcbiAgICAgICAgICB0aXRsZSxcclxuICAgICAgICB9LFxyXG4gICAgICAgIHtcclxuICAgICAgICAgIGhlaWdodCxcclxuICAgICAgICAgIHdpZHRoLFxyXG4gICAgICAgIH1cclxuICAgICAgKTtcclxuICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcclxuICAgICAgY29uc29sZS5lcnJvcihlcnJvci5tZXNzYWdlKTtcclxuICAgICAgdGhyb3cgbmV3IEVycm9yKGBYcm1FeC4ke2dldEZ1bmN0aW9uTmFtZSgpfTpcXG4ke2Vycm9yLm1lc3NhZ2V9YCk7XHJcbiAgICB9XHJcbiAgICAvKipcclxuICAgICAqIFVzZXMgY2FudmFzLm1lYXN1cmVUZXh0IHRvIGNvbXB1dGUgYW5kIHJldHVybiB0aGUgd2lkdGggb2YgdGhlIGdpdmVuIHRleHQgb2YgZ2l2ZW4gZm9udCBpbiBwaXhlbHMuXHJcbiAgICAgKlxyXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IHRleHQgVGhlIHRleHQgdG8gYmUgcmVuZGVyZWQuXHJcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gZm9udCBUaGUgY3NzIGZvbnQgZGVzY3JpcHRvciB0aGF0IHRleHQgaXMgdG8gYmUgcmVuZGVyZWQgd2l0aCAoZS5nLiBcImJvbGQgMTRweCB2ZXJkYW5hXCIpLlxyXG4gICAgICpcclxuICAgICAqIEBzZWUgaHR0cHM6Ly9zdGFja292ZXJmbG93LmNvbS9xdWVzdGlvbnMvMTE4MjQxL2NhbGN1bGF0ZS10ZXh0LXdpZHRoLXdpdGgtamF2YXNjcmlwdC8yMTAxNTM5MyMyMTAxNTM5M1xyXG4gICAgICovXHJcbiAgICBmdW5jdGlvbiBnZXRUZXh0V2lkdGgodGV4dDogc3RyaW5nLCBmb250OiBzdHJpbmcpIHtcclxuICAgICAgY29uc3QgY2FudmFzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImNhbnZhc1wiKTtcclxuICAgICAgY29uc3QgY29udGV4dCA9IGNhbnZhcy5nZXRDb250ZXh0KFwiMmRcIik7XHJcbiAgICAgIGNvbnRleHQuZm9udCA9IGZvbnQ7XHJcbiAgICAgIGNvbnN0IG1ldHJpY3MgPSBjb250ZXh0Lm1lYXN1cmVUZXh0KHRleHQpO1xyXG4gICAgICByZXR1cm4gbWV0cmljcy53aWR0aDtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIGV4cG9ydCBjbGFzcyBQcm9jZXNzIHtcclxuICAgIHN0YXRpYyBnZXQgZGF0YSgpIHtcclxuICAgICAgcmV0dXJuIEZvcm0uZm9ybUNvbnRleHQuZGF0YS5wcm9jZXNzO1xyXG4gICAgfVxyXG4gICAgc3RhdGljIGdldCB1aSgpIHtcclxuICAgICAgcmV0dXJuIEZvcm0uZm9ybUNvbnRleHQudWkucHJvY2VzcztcclxuICAgIH1cclxuICAgIC8qKlxyXG4gICAgICogVXNlIHRoaXMgdG8gYWRkIGEgZnVuY3Rpb24gYXMgYW4gZXZlbnQgaGFuZGxlciBmb3IgdGhlIE9uUHJlUHJvY2Vzc1N0YXR1c0NoYW5nZSBldmVudCBzbyB0aGF0IGl0IHdpbGwgYmUgY2FsbGVkIGJlZm9yZSB0aGVcclxuICAgICAqIGJ1c2luZXNzIHByb2Nlc3MgZmxvdyBzdGF0dXMgY2hhbmdlcy5cclxuICAgICAqIEBwYXJhbSBoYW5kbGVyIFRoZSBmdW5jdGlvbiB3aWxsIGJlIGFkZGVkIHRvIHRoZSBib3R0b20gb2YgdGhlIGV2ZW50XHJcbiAgICAgKiAgICAgICAgICAgICAgICBoYW5kbGVyIHBpcGVsaW5lLiBUaGUgZXhlY3V0aW9uIGNvbnRleHQgaXMgYXV0b21hdGljYWxseVxyXG4gICAgICogICAgICAgICAgICAgICAgc2V0IHRvIGJlIHRoZSBmaXJzdCBwYXJhbWV0ZXIgcGFzc2VkIHRvIHRoZSBldmVudCBoYW5kbGVyLlxyXG4gICAgICogICAgICAgICAgICAgICAgVXNlIGEgcmVmZXJlbmNlIHRvIGEgbmFtZWQgZnVuY3Rpb24gcmF0aGVyIHRoYW4gYW5cclxuICAgICAqICAgICAgICAgICAgICAgIGFub255bW91cyBmdW5jdGlvbiBpZiB5b3UgbWF5IGxhdGVyIHdhbnQgdG8gcmVtb3ZlIHRoZVxyXG4gICAgICogICAgICAgICAgICAgICAgZXZlbnQgaGFuZGxlci5cclxuICAgICAqL1xyXG4gICAgc3RhdGljIGFkZE9uUHJlUHJvY2Vzc1N0YXR1c0NoYW5nZShcclxuICAgICAgaGFuZGxlcjogWHJtLkV2ZW50cy5Qcm9jZXNzU3RhdHVzQ2hhbmdlSGFuZGxlclxyXG4gICAgKSB7XHJcbiAgICAgIEZvcm0uZm9ybUNvbnRleHQuZGF0YS5wcm9jZXNzLnJlbW92ZU9uUHJlUHJvY2Vzc1N0YXR1c0NoYW5nZShoYW5kbGVyKTtcclxuICAgICAgcmV0dXJuIEZvcm0uZm9ybUNvbnRleHQuZGF0YS5wcm9jZXNzLmFkZE9uUHJlUHJvY2Vzc1N0YXR1c0NoYW5nZShoYW5kbGVyKTtcclxuICAgIH1cclxuICAgIC8qKlxyXG4gICAgICogVXNlIHRoaXMgdG8gYWRkIGEgZnVuY3Rpb24gYXMgYW4gZXZlbnQgaGFuZGxlciBmb3IgdGhlIE9uUHJlU3RhZ2VDaGFuZ2UgZXZlbnQgc28gdGhhdCBpdCB3aWxsIGJlIGNhbGxlZCBiZWZvcmUgdGhlXHJcbiAgICAgKiBidXNpbmVzcyBwcm9jZXNzIGZsb3cgc3RhZ2UgY2hhbmdlcy5cclxuICAgICAqIEBwYXJhbSBoYW5kbGVyIFRoZSBmdW5jdGlvbiB3aWxsIGJlIGFkZGVkIHRvIHRoZSBib3R0b20gb2YgdGhlIGV2ZW50XHJcbiAgICAgKiAgICAgICAgICAgICAgICBoYW5kbGVyIHBpcGVsaW5lLiBUaGUgZXhlY3V0aW9uIGNvbnRleHQgaXMgYXV0b21hdGljYWxseVxyXG4gICAgICogICAgICAgICAgICAgICAgc2V0IHRvIGJlIHRoZSBmaXJzdCBwYXJhbWV0ZXIgcGFzc2VkIHRvIHRoZSBldmVudCBoYW5kbGVyLlxyXG4gICAgICogICAgICAgICAgICAgICAgVXNlIGEgcmVmZXJlbmNlIHRvIGEgbmFtZWQgZnVuY3Rpb24gcmF0aGVyIHRoYW4gYW5cclxuICAgICAqICAgICAgICAgICAgICAgIGFub255bW91cyBmdW5jdGlvbiBpZiB5b3UgbWF5IGxhdGVyIHdhbnQgdG8gcmVtb3ZlIHRoZVxyXG4gICAgICogICAgICAgICAgICAgICAgZXZlbnQgaGFuZGxlci5cclxuICAgICAqL1xyXG4gICAgc3RhdGljIGFkZE9uUHJlU3RhZ2VDaGFuZ2UoaGFuZGxlcjogWHJtLkV2ZW50cy5TdGFnZUNoYW5nZUV2ZW50SGFuZGxlcikge1xyXG4gICAgICBGb3JtLmZvcm1Db250ZXh0LmRhdGEucHJvY2Vzcy5yZW1vdmVPblByZVN0YWdlQ2hhbmdlKGhhbmRsZXIpO1xyXG4gICAgICByZXR1cm4gRm9ybS5mb3JtQ29udGV4dC5kYXRhLnByb2Nlc3MuYWRkT25QcmVTdGFnZUNoYW5nZShoYW5kbGVyKTtcclxuICAgIH1cclxuICAgIC8qKlxyXG4gICAgICogVXNlIHRoaXMgdG8gYWRkIGEgZnVuY3Rpb24gYXMgYW4gZXZlbnQgaGFuZGxlciBmb3IgdGhlIE9uUHJlUHJvY2Vzc1N0YXR1c0NoYW5nZSBldmVudCBzbyB0aGF0IGl0IHdpbGwgYmUgY2FsbGVkIHdoZW4gdGhlXHJcbiAgICAgKiBidXNpbmVzcyBwcm9jZXNzIGZsb3cgc3RhdHVzIGNoYW5nZXMuXHJcbiAgICAgKiBAcGFyYW0gaGFuZGxlciBUaGUgZnVuY3Rpb24gd2lsbCBiZSBhZGRlZCB0byB0aGUgYm90dG9tIG9mIHRoZSBldmVudFxyXG4gICAgICogICAgICAgICAgICAgICAgaGFuZGxlciBwaXBlbGluZS4gVGhlIGV4ZWN1dGlvbiBjb250ZXh0IGlzIGF1dG9tYXRpY2FsbHlcclxuICAgICAqICAgICAgICAgICAgICAgIHNldCB0byBiZSB0aGUgZmlyc3QgcGFyYW1ldGVyIHBhc3NlZCB0byB0aGUgZXZlbnQgaGFuZGxlci5cclxuICAgICAqICAgICAgICAgICAgICAgIFVzZSBhIHJlZmVyZW5jZSB0byBhIG5hbWVkIGZ1bmN0aW9uIHJhdGhlciB0aGFuIGFuXHJcbiAgICAgKiAgICAgICAgICAgICAgICBhbm9ueW1vdXMgZnVuY3Rpb24gaWYgeW91IG1heSBsYXRlciB3YW50IHRvIHJlbW92ZSB0aGVcclxuICAgICAqICAgICAgICAgICAgICAgIGV2ZW50IGhhbmRsZXIuXHJcbiAgICAgKi9cclxuICAgIHN0YXRpYyBhZGRPblByb2Nlc3NTdGF0dXNDaGFuZ2UoXHJcbiAgICAgIGhhbmRsZXI6IFhybS5FdmVudHMuUHJvY2Vzc1N0YXR1c0NoYW5nZUhhbmRsZXJcclxuICAgICkge1xyXG4gICAgICBGb3JtLmZvcm1Db250ZXh0LmRhdGEucHJvY2Vzcy5yZW1vdmVPblByb2Nlc3NTdGF0dXNDaGFuZ2UoaGFuZGxlcik7XHJcbiAgICAgIHJldHVybiBGb3JtLmZvcm1Db250ZXh0LmRhdGEucHJvY2Vzcy5hZGRPblByb2Nlc3NTdGF0dXNDaGFuZ2UoaGFuZGxlcik7XHJcbiAgICB9XHJcbiAgICAvKipcclxuICAgICAqIFVzZSB0aGlzIHRvIGFkZCBhIGZ1bmN0aW9uIGFzIGFuIGV2ZW50IGhhbmRsZXIgZm9yIHRoZSBPblN0YWdlQ2hhbmdlIGV2ZW50IHNvIHRoYXQgaXQgd2lsbCBiZSBjYWxsZWQgd2hlbiB0aGVcclxuICAgICAqIGJ1c2luZXNzIHByb2Nlc3MgZmxvdyBzdGFnZSBjaGFuZ2VzLlxyXG4gICAgICogQHBhcmFtIGhhbmRsZXIgVGhlIGZ1bmN0aW9uIHdpbGwgYmUgYWRkZWQgdG8gdGhlIGJvdHRvbSBvZiB0aGUgZXZlbnRcclxuICAgICAqICAgICAgICAgICAgICAgIGhhbmRsZXIgcGlwZWxpbmUuIFRoZSBleGVjdXRpb24gY29udGV4dCBpcyBhdXRvbWF0aWNhbGx5XHJcbiAgICAgKiAgICAgICAgICAgICAgICBzZXQgdG8gYmUgdGhlIGZpcnN0IHBhcmFtZXRlciBwYXNzZWQgdG8gdGhlIGV2ZW50IGhhbmRsZXIuXHJcbiAgICAgKiAgICAgICAgICAgICAgICBVc2UgYSByZWZlcmVuY2UgdG8gYSBuYW1lZCBmdW5jdGlvbiByYXRoZXIgdGhhbiBhblxyXG4gICAgICogICAgICAgICAgICAgICAgYW5vbnltb3VzIGZ1bmN0aW9uIGlmIHlvdSBtYXkgbGF0ZXIgd2FudCB0byByZW1vdmUgdGhlXHJcbiAgICAgKiAgICAgICAgICAgICAgICBldmVudCBoYW5kbGVyLlxyXG4gICAgICovXHJcbiAgICBzdGF0aWMgYWRkT25TdGFnZUNoYW5nZShoYW5kbGVyOiBYcm0uRXZlbnRzLlN0YWdlQ2hhbmdlRXZlbnRIYW5kbGVyKSB7XHJcbiAgICAgIEZvcm0uZm9ybUNvbnRleHQuZGF0YS5wcm9jZXNzLnJlbW92ZU9uU3RhZ2VDaGFuZ2UoaGFuZGxlcik7XHJcbiAgICAgIHJldHVybiBGb3JtLmZvcm1Db250ZXh0LmRhdGEucHJvY2Vzcy5hZGRPblN0YWdlQ2hhbmdlKGhhbmRsZXIpO1xyXG4gICAgfVxyXG4gICAgLyoqXHJcbiAgICAgKiBVc2UgdGhpcyB0byBhZGQgYSBmdW5jdGlvbiBhcyBhbiBldmVudCBoYW5kbGVyIGZvciB0aGUgT25TdGFnZVNlbGVjdGVkIGV2ZW50IHNvIHRoYXQgaXQgd2lsbCBiZSBjYWxsZWRcclxuICAgICAqIHdoZW4gYSBidXNpbmVzcyBwcm9jZXNzIGZsb3cgc3RhZ2UgaXMgc2VsZWN0ZWQuXHJcbiAgICAgKiBAcGFyYW0gaGFuZGxlciBUaGUgZnVuY3Rpb24gd2lsbCBiZSBhZGRlZCB0byB0aGUgYm90dG9tIG9mIHRoZSBldmVudFxyXG4gICAgICogICAgICAgICAgICAgICAgaGFuZGxlciBwaXBlbGluZS4gVGhlIGV4ZWN1dGlvbiBjb250ZXh0IGlzIGF1dG9tYXRpY2FsbHlcclxuICAgICAqICAgICAgICAgICAgICAgIHNldCB0byBiZSB0aGUgZmlyc3QgcGFyYW1ldGVyIHBhc3NlZCB0byB0aGUgZXZlbnQgaGFuZGxlci5cclxuICAgICAqICAgICAgICAgICAgICAgIFVzZSBhIHJlZmVyZW5jZSB0byBhIG5hbWVkIGZ1bmN0aW9uIHJhdGhlciB0aGFuIGFuXHJcbiAgICAgKiAgICAgICAgICAgICAgICBhbm9ueW1vdXMgZnVuY3Rpb24gaWYgeW91IG1heSBsYXRlciB3YW50IHRvIHJlbW92ZSB0aGVcclxuICAgICAqICAgICAgICAgICAgICAgIGV2ZW50IGhhbmRsZXIuXHJcbiAgICAgKi9cclxuICAgIHN0YXRpYyBhZGRPblN0YWdlU2VsZWN0ZWQoaGFuZGxlcjogWHJtLkV2ZW50cy5Db250ZXh0U2Vuc2l0aXZlSGFuZGxlcikge1xyXG4gICAgICBGb3JtLmZvcm1Db250ZXh0LmRhdGEucHJvY2Vzcy5yZW1vdmVPblN0YWdlU2VsZWN0ZWQoaGFuZGxlcik7XHJcbiAgICAgIHJldHVybiBGb3JtLmZvcm1Db250ZXh0LmRhdGEucHJvY2Vzcy5hZGRPblN0YWdlU2VsZWN0ZWQoaGFuZGxlcik7XHJcbiAgICB9XHJcbiAgICAvKipcclxuICAgICAqIFVzZSB0aGlzIHRvIHJlbW92ZSBhIGZ1bmN0aW9uIGFzIGFuIGV2ZW50IGhhbmRsZXIgZm9yIHRoZSBPblByZVByb2Nlc3NTdGF0dXNDaGFuZ2UgZXZlbnQuXHJcbiAgICAgKiBAcGFyYW0gaGFuZGxlciBJZiBhbiBhbm9ueW1vdXMgZnVuY3Rpb24gaXMgc2V0IHVzaW5nIHRoZSBhZGRPblByZVByb2Nlc3NTdGF0dXNDaGFuZ2UgbWV0aG9kIGl0XHJcbiAgICAgKiAgICAgICAgICAgICAgICBjYW5ub3QgYmUgcmVtb3ZlZCB1c2luZyB0aGlzIG1ldGhvZC5cclxuICAgICAqL1xyXG4gICAgc3RhdGljIHJlbW92ZU9uUHJlUHJvY2Vzc1N0YXR1c0NoYW5nZShcclxuICAgICAgaGFuZGxlcjogWHJtLkV2ZW50cy5Qcm9jZXNzU3RhdHVzQ2hhbmdlSGFuZGxlclxyXG4gICAgKSB7XHJcbiAgICAgIHJldHVybiBGb3JtLmZvcm1Db250ZXh0LmRhdGEucHJvY2Vzcy5yZW1vdmVPblByZVByb2Nlc3NTdGF0dXNDaGFuZ2UoXHJcbiAgICAgICAgaGFuZGxlclxyXG4gICAgICApO1xyXG4gICAgfVxyXG4gICAgLyoqXHJcbiAgICAgKiBVc2UgdGhpcyB0byByZW1vdmUgYSBmdW5jdGlvbiBhcyBhbiBldmVudCBoYW5kbGVyIGZvciB0aGUgT25QcmVTdGFnZUNoYW5nZSBldmVudC5cclxuICAgICAqIEBwYXJhbSBoYW5kbGVyIElmIGFuIGFub255bW91cyBmdW5jdGlvbiBpcyBzZXQgdXNpbmcgdGhlIGFkZE9uUHJlU3RhZ2VDaGFuZ2UgbWV0aG9kIGl0XHJcbiAgICAgKiAgICAgICAgICAgICAgICBjYW5ub3QgYmUgcmVtb3ZlZCB1c2luZyB0aGlzIG1ldGhvZC5cclxuICAgICAqL1xyXG4gICAgc3RhdGljIHJlbW92ZU9uUHJlU3RhZ2VDaGFuZ2UoaGFuZGxlcjogWHJtLkV2ZW50cy5TdGFnZUNoYW5nZUV2ZW50SGFuZGxlcikge1xyXG4gICAgICByZXR1cm4gRm9ybS5mb3JtQ29udGV4dC5kYXRhLnByb2Nlc3MucmVtb3ZlT25QcmVTdGFnZUNoYW5nZShoYW5kbGVyKTtcclxuICAgIH1cclxuICAgIC8qKlxyXG4gICAgICogVXNlIHRoaXMgdG8gcmVtb3ZlIGEgZnVuY3Rpb24gYXMgYW4gZXZlbnQgaGFuZGxlciBmb3IgdGhlIE9uUHJvY2Vzc1N0YXR1c0NoYW5nZSBldmVudC5cclxuICAgICAqIEBwYXJhbSBoYW5kbGVyIElmIGFuIGFub255bW91cyBmdW5jdGlvbiBpcyBzZXQgdXNpbmcgdGhlIGFkZE9uUHJvY2Vzc1N0YXR1c0NoYW5nZSBtZXRob2QgaXRcclxuICAgICAqICAgICAgICAgICAgICAgIGNhbm5vdCBiZSByZW1vdmVkIHVzaW5nIHRoaXMgbWV0aG9kLlxyXG4gICAgICovXHJcbiAgICBzdGF0aWMgcmVtb3ZlT25Qcm9jZXNzU3RhdHVzQ2hhbmdlKFxyXG4gICAgICBoYW5kbGVyOiBYcm0uRXZlbnRzLlByb2Nlc3NTdGF0dXNDaGFuZ2VIYW5kbGVyXHJcbiAgICApIHtcclxuICAgICAgcmV0dXJuIEZvcm0uZm9ybUNvbnRleHQuZGF0YS5wcm9jZXNzLnJlbW92ZU9uUHJvY2Vzc1N0YXR1c0NoYW5nZShoYW5kbGVyKTtcclxuICAgIH1cclxuICAgIC8qKlxyXG4gICAgICogVXNlIHRoaXMgdG8gcmVtb3ZlIGEgZnVuY3Rpb24gYXMgYW4gZXZlbnQgaGFuZGxlciBmb3IgdGhlIE9uU3RhZ2VDaGFuZ2UgZXZlbnQuXHJcbiAgICAgKiBAcGFyYW0gaGFuZGxlciBJZiBhbiBhbm9ueW1vdXMgZnVuY3Rpb24gaXMgc2V0IHVzaW5nIHRoZSBhZGRPblN0YWdlQ2hhbmdlIG1ldGhvZCBpdFxyXG4gICAgICogICAgICAgICAgICAgICAgY2Fubm90IGJlIHJlbW92ZWQgdXNpbmcgdGhpcyBtZXRob2QuXHJcbiAgICAgKi9cclxuICAgIHN0YXRpYyByZW1vdmVPblN0YWdlQ2hhbmdlKGhhbmRsZXI6IFhybS5FdmVudHMuU3RhZ2VDaGFuZ2VFdmVudEhhbmRsZXIpIHtcclxuICAgICAgcmV0dXJuIEZvcm0uZm9ybUNvbnRleHQuZGF0YS5wcm9jZXNzLnJlbW92ZU9uU3RhZ2VDaGFuZ2UoaGFuZGxlcik7XHJcbiAgICB9XHJcbiAgICAvKipcclxuICAgICAqIFVzZSB0aGlzIHRvIHJlbW92ZSBhIGZ1bmN0aW9uIGFzIGFuIGV2ZW50IGhhbmRsZXIgZm9yIHRoZSBPblN0YWdlQ2hhbmdlIGV2ZW50LlxyXG4gICAgICogQHBhcmFtIGhhbmRsZXIgSWYgYW4gYW5vbnltb3VzIGZ1bmN0aW9uIGlzIHNldCB1c2luZyB0aGUgYWRkT25TdGFnZUNoYW5nZSBtZXRob2QgaXRcclxuICAgICAqICAgICAgICAgICAgICAgIGNhbm5vdCBiZSByZW1vdmVkIHVzaW5nIHRoaXMgbWV0aG9kLlxyXG4gICAgICovXHJcbiAgICBzdGF0aWMgcmVtb3ZlT25TdGFnZVNlbGVjdGVkKGhhbmRsZXI6IFhybS5FdmVudHMuQ29udGV4dFNlbnNpdGl2ZUhhbmRsZXIpIHtcclxuICAgICAgcmV0dXJuIEZvcm0uZm9ybUNvbnRleHQuZGF0YS5wcm9jZXNzLnJlbW92ZU9uU3RhZ2VTZWxlY3RlZChoYW5kbGVyKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFVzZSB0aGlzIG1ldGhvZCB0byBhc3luY2hyb25vdXNseSByZXRyaWV2ZSB0aGUgZW5hYmxlZCBidXNpbmVzcyBwcm9jZXNzIGZsb3dzIHRoYXQgdGhlIHVzZXIgY2FuIHN3aXRjaCB0byBmb3IgYW4gZW50aXR5LlxyXG4gICAgICogQHJldHVybnMgcmV0dXJucyBjYWxsYmFjayByZXNwb25zZSBhcyBQcm9taXNlXHJcbiAgICAgKi9cclxuICAgIHN0YXRpYyBnZXRFbmFibGVkUHJvY2Vzc2VzKCkge1xyXG4gICAgICByZXR1cm4gYXNQcm9taXNlPFhybS5Qcm9jZXNzRmxvdy5Qcm9jZXNzRGljdGlvbmFyeT4oXHJcbiAgICAgICAgRm9ybS5mb3JtQ29udGV4dC5kYXRhLnByb2Nlc3MuZ2V0RW5hYmxlZFByb2Nlc3NlcyxcclxuICAgICAgICBGb3JtLmZvcm1Db250ZXh0LmRhdGEucHJvY2Vzc1xyXG4gICAgICApO1xyXG4gICAgfVxyXG4gICAgLyoqXHJcbiAgICAgKiBSZXR1cm5zIGFsbCBwcm9jZXNzIGluc3RhbmNlcyBmb3IgdGhlIGVudGl0eSByZWNvcmQgdGhhdCB0aGUgY2FsbGluZyB1c2VyIGhhcyBhY2Nlc3MgdG8uXHJcbiAgICAgKiBAcmV0dXJucyByZXR1cm5zIGNhbGxiYWNrIHJlc3BvbnNlIGFzIFByb21pc2VcclxuICAgICAqL1xyXG4gICAgc3RhdGljIGdldFByb2Nlc3NJbnN0YW5jZXMoKSB7XHJcbiAgICAgIHJldHVybiBhc1Byb21pc2U8WHJtLlByb2Nlc3NGbG93LkdldFByb2Nlc3NJbnN0YW5jZXNEZWxlZ2F0ZT4oXHJcbiAgICAgICAgRm9ybS5mb3JtQ29udGV4dC5kYXRhLnByb2Nlc3MuZ2V0UHJvY2Vzc0luc3RhbmNlcyxcclxuICAgICAgICBGb3JtLmZvcm1Db250ZXh0LmRhdGEucHJvY2Vzc1xyXG4gICAgICApO1xyXG4gICAgfVxyXG4gICAgLyoqXHJcbiAgICAgKiBQcm9ncmVzc2VzIHRvIHRoZSBuZXh0IHN0YWdlLlxyXG4gICAgICogQHJldHVybnMgcmV0dXJucyBjYWxsYmFjayByZXNwb25zZSBhcyBQcm9taXNlXHJcbiAgICAgKi9cclxuICAgIHN0YXRpYyBtb3ZlTmV4dCgpIHtcclxuICAgICAgcmV0dXJuIGFzUHJvbWlzZTxYcm0uUHJvY2Vzc0Zsb3cuUHJvY2Vzc0NhbGxiYWNrRGVsZWdhdGU+KFxyXG4gICAgICAgIEZvcm0uZm9ybUNvbnRleHQuZGF0YS5wcm9jZXNzLm1vdmVOZXh0LFxyXG4gICAgICAgIEZvcm0uZm9ybUNvbnRleHQuZGF0YS5wcm9jZXNzXHJcbiAgICAgICk7XHJcbiAgICB9XHJcbiAgICAvKipcclxuICAgICAqIE1vdmVzIHRvIHRoZSBwcmV2aW91cyBzdGFnZS5cclxuICAgICAqIEByZXR1cm5zIHJldHVybnMgY2FsbGJhY2sgcmVzcG9uc2UgYXMgUHJvbWlzZVxyXG4gICAgICovXHJcbiAgICBzdGF0aWMgbW92ZVByZXZpb3VzKCkge1xyXG4gICAgICByZXR1cm4gYXNQcm9taXNlPFhybS5Qcm9jZXNzRmxvdy5Qcm9jZXNzQ2FsbGJhY2tEZWxlZ2F0ZT4oXHJcbiAgICAgICAgRm9ybS5mb3JtQ29udGV4dC5kYXRhLnByb2Nlc3MubW92ZVByZXZpb3VzLFxyXG4gICAgICAgIEZvcm0uZm9ybUNvbnRleHQuZGF0YS5wcm9jZXNzXHJcbiAgICAgICk7XHJcbiAgICB9XHJcbiAgICAvKipcclxuICAgICAqIFNldCBhIFByb2Nlc3MgYXMgdGhlIGFjdGl2ZSBwcm9jZXNzLlxyXG4gICAgICogQHBhcmFtIHByb2Nlc3NJZCBUaGUgSWQgb2YgdGhlIHByb2Nlc3MgdG8gbWFrZSB0aGUgYWN0aXZlIHByb2Nlc3MuXHJcbiAgICAgKiBAcmV0dXJucyByZXR1cm5zIGNhbGxiYWNrIHJlc3BvbnNlIGFzIFByb21pc2VcclxuICAgICAqL1xyXG4gICAgc3RhdGljIHNldEFjdGl2ZVByb2Nlc3MocHJvY2Vzc0lkOiBzdHJpbmcpIHtcclxuICAgICAgcmV0dXJuIGFzUHJvbWlzZTxYcm0uUHJvY2Vzc0Zsb3cuUHJvY2Vzc0NhbGxiYWNrRGVsZWdhdGU+KFxyXG4gICAgICAgIEZvcm0uZm9ybUNvbnRleHQuZGF0YS5wcm9jZXNzLnNldEFjdGl2ZVByb2Nlc3MsXHJcbiAgICAgICAgRm9ybS5mb3JtQ29udGV4dC5kYXRhLnByb2Nlc3MsXHJcbiAgICAgICAgcHJvY2Vzc0lkXHJcbiAgICAgICk7XHJcbiAgICB9XHJcbiAgICAvKipcclxuICAgICAqIFNldHMgYSBwcm9jZXNzIGluc3RhbmNlIGFzIHRoZSBhY3RpdmUgaW5zdGFuY2VcclxuICAgICAqIEBwYXJhbSBwcm9jZXNzSW5zdGFuY2VJZCBUaGUgSWQgb2YgdGhlIHByb2Nlc3MgaW5zdGFuY2UgdG8gbWFrZSB0aGUgYWN0aXZlIGluc3RhbmNlLlxyXG4gICAgICogQHJldHVybnMgcmV0dXJucyBjYWxsYmFjayByZXNwb25zZSBhcyBQcm9taXNlXHJcbiAgICAgKi9cclxuICAgIHN0YXRpYyBzZXRBY3RpdmVQcm9jZXNzSW5zdGFuY2UocHJvY2Vzc0luc3RhbmNlSWQ6IHN0cmluZykge1xyXG4gICAgICByZXR1cm4gYXNQcm9taXNlPFhybS5Qcm9jZXNzRmxvdy5TZXRQcm9jZXNzSW5zdGFuY2VEZWxlZ2F0ZT4oXHJcbiAgICAgICAgRm9ybS5mb3JtQ29udGV4dC5kYXRhLnByb2Nlc3Muc2V0QWN0aXZlUHJvY2Vzc0luc3RhbmNlLFxyXG4gICAgICAgIEZvcm0uZm9ybUNvbnRleHQuZGF0YS5wcm9jZXNzLFxyXG4gICAgICAgIHByb2Nlc3NJbnN0YW5jZUlkXHJcbiAgICAgICk7XHJcbiAgICB9XHJcbiAgICAvKipcclxuICAgICAqIFNldCBhIHN0YWdlIGFzIHRoZSBhY3RpdmUgc3RhZ2UuXHJcbiAgICAgKiBAcGFyYW0gc3RhZ2VJZCB0aGUgSWQgb2YgdGhlIHN0YWdlIHRvIG1ha2UgdGhlIGFjdGl2ZSBzdGFnZS5cclxuICAgICAqIEByZXR1cm5zIHJldHVybnMgY2FsbGJhY2sgcmVzcG9uc2UgYXMgUHJvbWlzZVxyXG4gICAgICovXHJcbiAgICBzdGF0aWMgc2V0QWN0aXZlU3RhZ2Uoc3RhZ2VJZDogc3RyaW5nKSB7XHJcbiAgICAgIHJldHVybiBhc1Byb21pc2U8WHJtLlByb2Nlc3NGbG93LlNldFByb2Nlc3NJbnN0YW5jZURlbGVnYXRlPihcclxuICAgICAgICBGb3JtLmZvcm1Db250ZXh0LmRhdGEucHJvY2Vzcy5zZXRBY3RpdmVTdGFnZSxcclxuICAgICAgICBGb3JtLmZvcm1Db250ZXh0LmRhdGEucHJvY2VzcyxcclxuICAgICAgICBzdGFnZUlkXHJcbiAgICAgICk7XHJcbiAgICB9XHJcbiAgICAvKipcclxuICAgICAqIFVzZSB0aGlzIG1ldGhvZCB0byBzZXQgdGhlIGN1cnJlbnQgc3RhdHVzIG9mIHRoZSBwcm9jZXNzIGluc3RhbmNlXHJcbiAgICAgKiBAcGFyYW0gc3RhdHVzIFRoZSBuZXcgc3RhdHVzIGZvciB0aGUgcHJvY2Vzc1xyXG4gICAgICogQHJldHVybnMgcmV0dXJucyBjYWxsYmFjayByZXNwb25zZSBhcyBQcm9taXNlXHJcbiAgICAgKi9cclxuICAgIHN0YXRpYyBzZXRTdGF0dXMoc3RhdHVzOiBYcm0uUHJvY2Vzc0Zsb3cuUHJvY2Vzc1N0YXR1cykge1xyXG4gICAgICByZXR1cm4gYXNQcm9taXNlPFhybS5Qcm9jZXNzRmxvdy5TZXRQcm9jZXNzSW5zdGFuY2VEZWxlZ2F0ZT4oXHJcbiAgICAgICAgRm9ybS5mb3JtQ29udGV4dC5kYXRhLnByb2Nlc3Muc2V0U3RhdHVzLFxyXG4gICAgICAgIEZvcm0uZm9ybUNvbnRleHQuZGF0YS5wcm9jZXNzLFxyXG4gICAgICAgIHN0YXR1c1xyXG4gICAgICApO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgZXhwb3J0IGNsYXNzIEZpZWxkcyB7XHJcbiAgICAvKipcclxuICAgICAqIEFkZHMgYSBoYW5kbGVyIG9yIGFuIGFycmF5IG9mIGhhbmRsZXJzIHRvIGJlIGNhbGxlZCB3aGVuIHRoZSBhdHRyaWJ1dGUncyB2YWx1ZSBpcyBjaGFuZ2VkLlxyXG4gICAgICogQHBhcmFtIGZpZWxkcyBBbiBhcnJheSBvZiBmaWVsZHMgdG8gb24gd2hpY2ggdGhpcyBtZXRob2Qgc2hvdWxkIGJlIGFwcGxpZWQuXHJcbiAgICAgKiBAcGFyYW0gaGFuZGxlcnMgVGhlIGZ1bmN0aW9uIHJlZmVyZW5jZSBvciBhbiBhcnJheSBvZiBmdW5jdGlvbiByZWZlcmVuY2VzLlxyXG4gICAgICovXHJcbiAgICBzdGF0aWMgYWRkT25DaGFuZ2UoXHJcbiAgICAgIGZpZWxkczogQ2xhc3MuRmllbGRbXSxcclxuICAgICAgaGFuZGxlcjogWHJtLkV2ZW50cy5BdHRyaWJ1dGUuQ2hhbmdlRXZlbnRIYW5kbGVyXHJcbiAgICApOiB2b2lkIHtcclxuICAgICAgZmllbGRzLmZvckVhY2goKGZpZWxkKSA9PiB7XHJcbiAgICAgICAgZmllbGQuYWRkT25DaGFuZ2UoaGFuZGxlcik7XHJcbiAgICAgIH0pO1xyXG4gICAgfVxyXG4gICAgLyoqXHJcbiAgICAgKiBGaXJlIGFsbCBcIm9uIGNoYW5nZVwiIGV2ZW50IGhhbmRsZXJzLlxyXG4gICAgICogQHBhcmFtIGZpZWxkcyBBbiBhcnJheSBvZiBmaWVsZHMgdG8gb24gd2hpY2ggdGhpcyBtZXRob2Qgc2hvdWxkIGJlIGFwcGxpZWQuXHJcbiAgICAgKi9cclxuICAgIHN0YXRpYyBmaXJlT25DaGFuZ2UoZmllbGRzOiBDbGFzcy5GaWVsZFtdKTogdm9pZCB7XHJcbiAgICAgIGZpZWxkcy5mb3JFYWNoKChmaWVsZCkgPT4ge1xyXG4gICAgICAgIGZpZWxkLmZpcmVPbkNoYW5nZSgpO1xyXG4gICAgICB9KTtcclxuICAgIH1cclxuICAgIC8qKlxyXG4gICAgICogUmVtb3ZlcyB0aGUgaGFuZGxlciBmcm9tIHRoZSBcIm9uIGNoYW5nZVwiIGV2ZW50LlxyXG4gICAgICogQHBhcmFtIGZpZWxkcyBBbiBhcnJheSBvZiBmaWVsZHMgdG8gb24gd2hpY2ggdGhpcyBtZXRob2Qgc2hvdWxkIGJlIGFwcGxpZWQuXHJcbiAgICAgKiBAcGFyYW0gaGFuZGxlciBUaGUgaGFuZGxlci5cclxuICAgICAqL1xyXG4gICAgc3RhdGljIHJlbW92ZU9uQ2hhbmdlKFxyXG4gICAgICBmaWVsZHM6IENsYXNzLkZpZWxkW10sXHJcbiAgICAgIGhhbmRsZXI6IFhybS5FdmVudHMuQXR0cmlidXRlLkNoYW5nZUV2ZW50SGFuZGxlclxyXG4gICAgKTogdm9pZCB7XHJcbiAgICAgIGZpZWxkcy5mb3JFYWNoKChmaWVsZCkgPT4ge1xyXG4gICAgICAgIGZpZWxkLnJlbW92ZU9uQ2hhbmdlKGhhbmRsZXIpO1xyXG4gICAgICB9KTtcclxuICAgIH1cclxuICAgIC8qKlxyXG4gICAgICogU2V0cyB0aGUgcmVxdWlyZWQgbGV2ZWwuXHJcbiAgICAgKiBAcGFyYW0gZmllbGRzIEFuIGFycmF5IG9mIGZpZWxkcyB0byBvbiB3aGljaCB0aGlzIG1ldGhvZCBzaG91bGQgYmUgYXBwbGllZC5cclxuICAgICAqIEBwYXJhbSByZXF1aXJlbWVudExldmVsIFRoZSByZXF1aXJlbWVudCBsZXZlbCwgYXMgZWl0aGVyIFwibm9uZVwiLCBcInJlcXVpcmVkXCIsIG9yIFwicmVjb21tZW5kZWRcIlxyXG4gICAgICovXHJcbiAgICBzdGF0aWMgc2V0UmVxdWlyZWRMZXZlbChcclxuICAgICAgZmllbGRzOiBDbGFzcy5GaWVsZFtdLFxyXG4gICAgICByZXF1aXJlbWVudExldmVsOiBYcm0uQXR0cmlidXRlcy5SZXF1aXJlbWVudExldmVsXHJcbiAgICApOiB2b2lkIHtcclxuICAgICAgZmllbGRzLmZvckVhY2goKGZpZWxkKSA9PiB7XHJcbiAgICAgICAgZmllbGQuc2V0UmVxdWlyZWRMZXZlbChyZXF1aXJlbWVudExldmVsKTtcclxuICAgICAgfSk7XHJcbiAgICB9XHJcbiAgICAvKipcclxuICAgICAqIFNldHMgdGhlIHN1Ym1pdCBtb2RlLlxyXG4gICAgICogQHBhcmFtIGZpZWxkcyBBbiBhcnJheSBvZiBmaWVsZHMgdG8gb24gd2hpY2ggdGhpcyBtZXRob2Qgc2hvdWxkIGJlIGFwcGxpZWQuXHJcbiAgICAgKiBAcGFyYW0gc3VibWl0TW9kZSBUaGUgc3VibWl0IG1vZGUsIGFzIGVpdGhlciBcImFsd2F5c1wiLCBcIm5ldmVyXCIsIG9yIFwiZGlydHlcIi5cclxuICAgICAqIEBkZWZhdWx0IHN1Ym1pdE1vZGUgXCJkaXJ0eVwiXHJcbiAgICAgKiBAc2VlIHtAbGluayBYcm1FbnVtLkF0dHJpYnV0ZVJlcXVpcmVtZW50TGV2ZWx9XHJcbiAgICAgKi9cclxuICAgIHN0YXRpYyBzZXRTdWJtaXRNb2RlKFxyXG4gICAgICBmaWVsZHM6IENsYXNzLkZpZWxkW10sXHJcbiAgICAgIHN1Ym1pdE1vZGU6IFhybS5TdWJtaXRNb2RlXHJcbiAgICApOiB2b2lkIHtcclxuICAgICAgZmllbGRzLmZvckVhY2goKGZpZWxkKSA9PiB7XHJcbiAgICAgICAgZmllbGQuc2V0U3VibWl0TW9kZShzdWJtaXRNb2RlKTtcclxuICAgICAgfSk7XHJcbiAgICB9XHJcbiAgICAvKipcclxuICAgICAqIFNldHMgdGhlIHZhbHVlLlxyXG4gICAgICogQHBhcmFtIGZpZWxkcyBBbiBhcnJheSBvZiBmaWVsZHMgdG8gb24gd2hpY2ggdGhpcyBtZXRob2Qgc2hvdWxkIGJlIGFwcGxpZWQuXHJcbiAgICAgKiBAcGFyYW0gdmFsdWUgVGhlIHZhbHVlLlxyXG4gICAgICogQHJlbWFya3MgQXR0cmlidXRlcyBvbiBRdWljayBDcmVhdGUgRm9ybXMgd2lsbCBub3Qgc2F2ZSB2YWx1ZXMgc2V0IHdpdGggdGhpcyBtZXRob2QuXHJcbiAgICAgKi9cclxuICAgIHN0YXRpYyBzZXRWYWx1ZShmaWVsZHM6IENsYXNzLkZpZWxkW10sIHZhbHVlOiBhbnkpOiB2b2lkIHtcclxuICAgICAgZmllbGRzLmZvckVhY2goKGZpZWxkKSA9PiB7XHJcbiAgICAgICAgZmllbGQuc2V0VmFsdWUodmFsdWUpO1xyXG4gICAgICB9KTtcclxuICAgIH1cclxuICAgIC8qKlxyXG4gICAgICogU2V0cyBhIHZhbHVlIGZvciBhIGNvbHVtbiB0byBkZXRlcm1pbmUgd2hldGhlciBpdCBpcyB2YWxpZCBvciBpbnZhbGlkIHdpdGggYSBtZXNzYWdlXHJcbiAgICAgKiBAcGFyYW0gZmllbGRzIEFuIGFycmF5IG9mIGZpZWxkcyB0byBvbiB3aGljaCB0aGlzIG1ldGhvZCBzaG91bGQgYmUgYXBwbGllZC5cclxuICAgICAqIEBwYXJhbSBpc1ZhbGlkIFNwZWNpZnkgZmFsc2UgdG8gc2V0IHRoZSBjb2x1bW4gdmFsdWUgdG8gaW52YWxpZCBhbmQgdHJ1ZSB0byBzZXQgdGhlIHZhbHVlIHRvIHZhbGlkLlxyXG4gICAgICogQHBhcmFtIG1lc3NhZ2UgVGhlIG1lc3NhZ2UgdG8gZGlzcGxheS5cclxuICAgICAqIEBzZWUge0BsaW5rIGh0dHBzOi8vbGVhcm4ubWljcm9zb2Z0LmNvbS9lbi11cy9wb3dlci1hcHBzL2RldmVsb3Blci9tb2RlbC1kcml2ZW4tYXBwcy9jbGllbnRhcGkvcmVmZXJlbmNlL2F0dHJpYnV0ZXMvc2V0aXN2YWxpZCBFeHRlcm5hbCBMaW5rOiBzZXRJc1ZhbGlkIChDbGllbnQgQVBJIHJlZmVyZW5jZSl9XHJcbiAgICAgKi9cclxuICAgIHN0YXRpYyBzZXRJc1ZhbGlkKFxyXG4gICAgICBmaWVsZHM6IENsYXNzLkZpZWxkW10sXHJcbiAgICAgIGlzVmFsaWQ6IGJvb2xlYW4sXHJcbiAgICAgIG1lc3NhZ2U/OiBzdHJpbmdcclxuICAgICk6IHZvaWQge1xyXG4gICAgICBmaWVsZHMuZm9yRWFjaCgoZmllbGQpID0+IHtcclxuICAgICAgICBmaWVsZC5zZXRJc1ZhbGlkKGlzVmFsaWQsIG1lc3NhZ2UpO1xyXG4gICAgICB9KTtcclxuICAgIH1cclxuICAgIC8qKlxyXG4gICAgICogU2V0cyB0aGUgcmVxdWlyZWQgbGV2ZWwuXHJcbiAgICAgKiBAcGFyYW0gZmllbGRzIEFuIGFycmF5IG9mIGZpZWxkcyB0byBvbiB3aGljaCB0aGlzIG1ldGhvZCBzaG91bGQgYmUgYXBwbGllZC5cclxuICAgICAqIEBwYXJhbSByZXF1aXJlZCBUaGUgcmVxdWlyZW1lbnQgbGV2ZWwsIGFzIGVpdGhlciBmYWxzZSBmb3IgXCJub25lXCIgb3IgdHJ1ZSBmb3IgXCJyZXF1aXJlZFwiXHJcbiAgICAgKi9cclxuICAgIHN0YXRpYyBzZXRSZXF1aXJlZChmaWVsZHM6IENsYXNzLkZpZWxkW10sIHJlcXVpcmVkOiBib29sZWFuKTogdm9pZCB7XHJcbiAgICAgIGZpZWxkcy5mb3JFYWNoKChmaWVsZCkgPT4ge1xyXG4gICAgICAgIGZpZWxkLnNldFJlcXVpcmVkKHJlcXVpcmVkKTtcclxuICAgICAgfSk7XHJcbiAgICB9XHJcbiAgICAvKipcclxuICAgICAqIFNldHMgdGhlIHN0YXRlIG9mIHRoZSBjb250cm9sIHRvIGVpdGhlciBlbmFibGVkLCBvciBkaXNhYmxlZC5cclxuICAgICAqIEBwYXJhbSBmaWVsZHMgQW4gYXJyYXkgb2YgZmllbGRzIHRvIG9uIHdoaWNoIHRoaXMgbWV0aG9kIHNob3VsZCBiZSBhcHBsaWVkLlxyXG4gICAgICogQHBhcmFtIGRpc2FibGVkIHRydWUgdG8gZGlzYWJsZSwgZmFsc2UgdG8gZW5hYmxlLlxyXG4gICAgICovXHJcbiAgICBzdGF0aWMgc2V0RGlzYWJsZWQoZmllbGRzOiBDbGFzcy5GaWVsZFtdLCBkaXNhYmxlZDogYm9vbGVhbik6IHZvaWQge1xyXG4gICAgICBmaWVsZHMuZm9yRWFjaCgoZmllbGQpID0+IHtcclxuICAgICAgICBmaWVsZC5zZXREaXNhYmxlZChkaXNhYmxlZCk7XHJcbiAgICAgIH0pO1xyXG4gICAgfVxyXG4gICAgLyoqXHJcbiAgICAgKiBTZXRzIHRoZSB2aXNpYmlsaXR5IHN0YXRlLlxyXG4gICAgICogQHBhcmFtIGZpZWxkcyBBbiBhcnJheSBvZiBmaWVsZHMgdG8gb24gd2hpY2ggdGhpcyBtZXRob2Qgc2hvdWxkIGJlIGFwcGxpZWQuXHJcbiAgICAgKiBAcGFyYW0gdmlzaWJsZSB0cnVlIHRvIHNob3csIGZhbHNlIHRvIGhpZGUuXHJcbiAgICAgKi9cclxuICAgIHN0YXRpYyBzZXRWaXNpYmxlKGZpZWxkczogQ2xhc3MuRmllbGRbXSwgdmlzaWJsZTogYm9vbGVhbik6IHZvaWQge1xyXG4gICAgICBmaWVsZHMuZm9yRWFjaCgoZmllbGQpID0+IHtcclxuICAgICAgICBmaWVsZC5zZXRWaXNpYmxlKHZpc2libGUpO1xyXG4gICAgICB9KTtcclxuICAgIH1cclxuICAgIC8qKlxyXG4gICAgICogU2V0cyBhIGNvbnRyb2wtbG9jYWwgbm90aWZpY2F0aW9uIG1lc3NhZ2UuXHJcbiAgICAgKiBAcGFyYW0gZmllbGRzIEFuIGFycmF5IG9mIGZpZWxkcyB0byBvbiB3aGljaCB0aGlzIG1ldGhvZCBzaG91bGQgYmUgYXBwbGllZC5cclxuICAgICAqIEBwYXJhbSBtZXNzYWdlIFRoZSBtZXNzYWdlLlxyXG4gICAgICogQHBhcmFtIHVuaXF1ZUlkIFVuaXF1ZSBpZGVudGlmaWVyLlxyXG4gICAgICogQHJldHVybnMgdHJ1ZSBpZiBpdCBzdWNjZWVkcywgZmFsc2UgaWYgaXQgZmFpbHMuXHJcbiAgICAgKiBAcmVtYXJrcyAgICAgV2hlbiB0aGlzIG1ldGhvZCBpcyB1c2VkIG9uIE1pY3Jvc29mdCBEeW5hbWljcyBDUk0gZm9yIHRhYmxldHMgYSByZWQgXCJYXCIgaWNvblxyXG4gICAgICogICAgICAgICAgICAgIGFwcGVhcnMgbmV4dCB0byB0aGUgY29udHJvbC4gVGFwcGluZyBvbiB0aGUgaWNvbiB3aWxsIGRpc3BsYXkgdGhlIG1lc3NhZ2UuXHJcbiAgICAgKi9cclxuICAgIHN0YXRpYyBzZXROb3RpZmljYXRpb24oXHJcbiAgICAgIGZpZWxkczogQ2xhc3MuRmllbGRbXSxcclxuICAgICAgbWVzc2FnZTogc3RyaW5nLFxyXG4gICAgICB1bmlxdWVJZDogc3RyaW5nXHJcbiAgICApOiB2b2lkIHtcclxuICAgICAgZmllbGRzLmZvckVhY2goKGZpZWxkKSA9PiB7XHJcbiAgICAgICAgZmllbGQuc2V0Tm90aWZpY2F0aW9uKG1lc3NhZ2UsIHVuaXF1ZUlkKTtcclxuICAgICAgfSk7XHJcbiAgICB9XHJcbiAgICAvKipcclxuICAgICAqIERpc3BsYXlzIGFuIGVycm9yIG9yIHJlY29tbWVuZGF0aW9uIG5vdGlmaWNhdGlvbiBmb3IgYSBjb250cm9sLCBhbmQgbGV0cyB5b3Ugc3BlY2lmeSBhY3Rpb25zIHRvIGV4ZWN1dGUgYmFzZWQgb24gdGhlIG5vdGlmaWNhdGlvbi5cclxuICAgICAqIEBwYXJhbSBmaWVsZHMgQW4gYXJyYXkgb2YgZmllbGRzIHRvIG9uIHdoaWNoIHRoaXMgbWV0aG9kIHNob3VsZCBiZSBhcHBsaWVkLlxyXG4gICAgICovXHJcbiAgICBzdGF0aWMgYWRkTm90aWZpY2F0aW9uKFxyXG4gICAgICBmaWVsZHM6IENsYXNzLkZpZWxkW10sXHJcbiAgICAgIG1lc3NhZ2U6IHN0cmluZyxcclxuICAgICAgbm90aWZpY2F0aW9uTGV2ZWw6IFwiRVJST1JcIiB8IFwiUkVDT01NRU5EQVRJT05cIixcclxuICAgICAgdW5pcXVlSWQ6IHN0cmluZyxcclxuICAgICAgYWN0aW9ucz86IFhybS5Db250cm9scy5Db250cm9sTm90aWZpY2F0aW9uQWN0aW9uW11cclxuICAgICk6IHZvaWQge1xyXG4gICAgICBmaWVsZHMuZm9yRWFjaCgoZmllbGQpID0+IHtcclxuICAgICAgICBmaWVsZC5hZGROb3RpZmljYXRpb24obWVzc2FnZSwgbm90aWZpY2F0aW9uTGV2ZWwsIHVuaXF1ZUlkLCBhY3Rpb25zKTtcclxuICAgICAgfSk7XHJcbiAgICB9XHJcbiAgICAvKipcclxuICAgICAqIENsZWFycyB0aGUgbm90aWZpY2F0aW9uIGlkZW50aWZpZWQgYnkgdW5pcXVlSWQuXHJcbiAgICAgKiBAcGFyYW0gZmllbGRzIEFuIGFycmF5IG9mIGZpZWxkcyB0byBvbiB3aGljaCB0aGlzIG1ldGhvZCBzaG91bGQgYmUgYXBwbGllZC5cclxuICAgICAqIEBwYXJhbSB1bmlxdWVJZCAoT3B0aW9uYWwpIFVuaXF1ZSBpZGVudGlmaWVyLlxyXG4gICAgICogQHJldHVybnMgdHJ1ZSBpZiBpdCBzdWNjZWVkcywgZmFsc2UgaWYgaXQgZmFpbHMuXHJcbiAgICAgKiBAcmVtYXJrcyBJZiB0aGUgdW5pcXVlSWQgcGFyYW1ldGVyIGlzIG5vdCB1c2VkLCB0aGUgY3VycmVudCBub3RpZmljYXRpb24gc2hvd24gd2lsbCBiZSByZW1vdmVkLlxyXG4gICAgICovXHJcbiAgICBzdGF0aWMgcmVtb3ZlTm90aWZpY2F0aW9uKGZpZWxkczogQ2xhc3MuRmllbGRbXSwgdW5pcXVlSWQ6IHN0cmluZyk6IHZvaWQge1xyXG4gICAgICBmaWVsZHMuZm9yRWFjaCgoZmllbGQpID0+IHtcclxuICAgICAgICBmaWVsZC5yZW1vdmVOb3RpZmljYXRpb24odW5pcXVlSWQpO1xyXG4gICAgICB9KTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFJlcHJlc2VudHMgYSBmb3JtIGluIER5bmFtaWNzIDM2NS5cclxuICAgKi9cclxuICBleHBvcnQgY2xhc3MgRm9ybSB7XHJcbiAgICBwcm90ZWN0ZWQgc3RhdGljIF9mb3JtQ29udGV4dDogWHJtLkZvcm1Db250ZXh0O1xyXG4gICAgcHJvdGVjdGVkIHN0YXRpYyBfZXhlY3V0aW9uQ29udGV4dDogWHJtLkV2ZW50cy5FdmVudENvbnRleHQ7XHJcbiAgICBjb25zdHJ1Y3RvcigpIHt9XHJcbiAgICAvKipHZXRzIGEgcmVmZXJlbmNlIHRvIHRoZSBjdXJyZW50IGZvcm0gY29udGV4dCovXHJcbiAgICBzdGF0aWMgZ2V0IGZvcm1Db250ZXh0KCk6IFhybS5Gb3JtQ29udGV4dCB7XHJcbiAgICAgIHJldHVybiB0aGlzLl9mb3JtQ29udGV4dDtcclxuICAgIH1cclxuICAgIC8qKkdldHMgYSByZWZlcmVuY2UgdG8gdGhlIGN1cnJlbnQgZXhlY3V0aW8gY29udGV4dCovXHJcbiAgICBzdGF0aWMgZ2V0IGV4ZWN1dGlvbkNvbnRleHQoKTogWHJtLkV2ZW50cy5FdmVudENvbnRleHQge1xyXG4gICAgICByZXR1cm4gdGhpcy5fZXhlY3V0aW9uQ29udGV4dDtcclxuICAgIH1cclxuICAgIC8qKkdldHMgYSBsb29rdXAgdmFsdWUgdGhhdCByZWZlcmVuY2VzIHRoZSByZWNvcmQuKi9cclxuICAgIHN0YXRpYyBnZXQgZW50aXR5UmVmZXJlbmNlKCkge1xyXG4gICAgICByZXR1cm4gRm9ybS5mb3JtQ29udGV4dC5kYXRhLmVudGl0eS5nZXRFbnRpdHlSZWZlcmVuY2UoKTtcclxuICAgIH1cclxuICAgIC8qKlNldHMgYSByZWZlcmVuY2UgdG8gdGhlIGN1cnJlbnQgZm9ybSBjb250ZXh0Ki9cclxuICAgIHN0YXRpYyBzZXQgZm9ybUNvbnRleHQoY29udGV4dDogWHJtLkZvcm1Db250ZXh0IHwgWHJtLkV2ZW50cy5FdmVudENvbnRleHQpIHtcclxuICAgICAgaWYgKCFjb250ZXh0KVxyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcclxuICAgICAgICAgIGBYcm1FeC5Gb3JtLnNldEZvcm1Db250ZXh0OiBUaGUgZXhlY3V0aW9uQ29udGV4dCBvciBmb3JtQ29udGV4dCB3YXMgbm90IHBhc3NlZCB0byB0aGUgZnVuY3Rpb24uYFxyXG4gICAgICAgICk7XHJcbiAgICAgIGlmIChcImdldEZvcm1Db250ZXh0XCIgaW4gY29udGV4dCkge1xyXG4gICAgICAgIHRoaXMuX2V4ZWN1dGlvbkNvbnRleHQgPSBjb250ZXh0O1xyXG4gICAgICAgIHRoaXMuX2Zvcm1Db250ZXh0ID0gY29udGV4dC5nZXRGb3JtQ29udGV4dCgpO1xyXG4gICAgICB9IGVsc2UgaWYgKFwiZGF0YVwiIGluIGNvbnRleHQpIHRoaXMuX2Zvcm1Db250ZXh0ID0gY29udGV4dDtcclxuICAgICAgZWxzZVxyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcclxuICAgICAgICAgIGBYcm1FeC5Gb3JtLnNldEZvcm1Db250ZXh0OiBUaGUgcGFzc2VkIGNvbnRleHQgaXMgbm90IGFuIGV4ZWN1dGlvbkNvbnRleHQgb3IgZm9ybUNvbnRleHQuYFxyXG4gICAgICAgICk7XHJcbiAgICB9XHJcbiAgICAvKipTZXRzIGEgcmVmZXJlbmNlIHRvIHRoZSBjdXJyZW50IGV4ZWN1dGlvbiBjb250ZXh0Ki9cclxuICAgIHN0YXRpYyBzZXQgZXhlY3V0aW9uQ29udGV4dChcclxuICAgICAgY29udGV4dDogWHJtLkZvcm1Db250ZXh0IHwgWHJtLkV2ZW50cy5FdmVudENvbnRleHRcclxuICAgICkge1xyXG4gICAgICBpZiAoIWNvbnRleHQpXHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxyXG4gICAgICAgICAgYFhybUV4LkZvcm0uc2V0RXhlY3V0aW9uQ29udGV4dDogVGhlIGV4ZWN1dGlvbkNvbnRleHQgb3IgZm9ybUNvbnRleHQgd2FzIG5vdCBwYXNzZWQgdG8gdGhlIGZ1bmN0aW9uLmBcclxuICAgICAgICApO1xyXG4gICAgICBpZiAoXCJnZXRGb3JtQ29udGV4dFwiIGluIGNvbnRleHQpIHtcclxuICAgICAgICB0aGlzLl9leGVjdXRpb25Db250ZXh0ID0gY29udGV4dDtcclxuICAgICAgICB0aGlzLl9mb3JtQ29udGV4dCA9IGNvbnRleHQuZ2V0Rm9ybUNvbnRleHQoKTtcclxuICAgICAgfSBlbHNlIGlmIChcImRhdGFcIiBpbiBjb250ZXh0KSB0aGlzLl9mb3JtQ29udGV4dCA9IGNvbnRleHQ7XHJcbiAgICAgIGVsc2VcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXHJcbiAgICAgICAgICBgWHJtRXguRm9ybS5zZXRFeGVjdXRpb25Db250ZXh0OiBUaGUgcGFzc2VkIGNvbnRleHQgaXMgbm90IGFuIGV4ZWN1dGlvbkNvbnRleHQgb3IgZm9ybUNvbnRleHQuYFxyXG4gICAgICAgICk7XHJcbiAgICB9XHJcbiAgICAvKipSZXR1cm5zIHRydWUgaWYgZm9ybSBpcyBmcm9tIHR5cGUgY3JlYXRlKi9cclxuICAgIHN0YXRpYyBnZXQgSXNDcmVhdGUoKSB7XHJcbiAgICAgIHJldHVybiBGb3JtLmZvcm1Db250ZXh0LnVpLmdldEZvcm1UeXBlKCkgPT0gMTtcclxuICAgIH1cclxuICAgIC8qKlJldHVybnMgdHJ1ZSBpZiBmb3JtIGlzIGZyb20gdHlwZSB1cGRhdGUqL1xyXG4gICAgc3RhdGljIGdldCBJc1VwZGF0ZSgpIHtcclxuICAgICAgcmV0dXJuIEZvcm0uZm9ybUNvbnRleHQudWkuZ2V0Rm9ybVR5cGUoKSA9PSAyO1xyXG4gICAgfVxyXG4gICAgLyoqUmV0dXJucyB0cnVlIGlmIGZvcm0gaXMgbm90IGZyb20gdHlwZSBjcmVhdGUqL1xyXG4gICAgc3RhdGljIGdldCBJc05vdENyZWF0ZSgpIHtcclxuICAgICAgcmV0dXJuIEZvcm0uZm9ybUNvbnRleHQudWkuZ2V0Rm9ybVR5cGUoKSAhPSAxO1xyXG4gICAgfVxyXG4gICAgLyoqUmV0dXJucyB0cnVlIGlmIGZvcm0gaXMgbm90IGZyb20gdHlwZSB1cGRhdGUqL1xyXG4gICAgc3RhdGljIGdldCBJc05vdFVwZGF0ZSgpIHtcclxuICAgICAgcmV0dXJuIEZvcm0uZm9ybUNvbnRleHQudWkuZ2V0Rm9ybVR5cGUoKSAhPSAyO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogRGlzcGxheXMgYSBmb3JtIGxldmVsIG5vdGlmaWNhdGlvbi4gQW55IG51bWJlciBvZiBub3RpZmljYXRpb25zIGNhbiBiZSBkaXNwbGF5ZWQgYW5kIHdpbGwgcmVtYWluIHVudGlsIHJlbW92ZWQgdXNpbmcgY2xlYXJGb3JtTm90aWZpY2F0aW9uLlxyXG4gICAgICogVGhlIGhlaWdodCBvZiB0aGUgbm90aWZpY2F0aW9uIGFyZWEgaXMgbGltaXRlZCBzbyBlYWNoIG5ldyBtZXNzYWdlIHdpbGwgYmUgYWRkZWQgdG8gdGhlIHRvcC5cclxuICAgICAqIEBwYXJhbSBtZXNzYWdlIFRoZSB0ZXh0IG9mIHRoZSBub3RpZmljYXRpb24gbWVzc2FnZS5cclxuICAgICAqIEBwYXJhbSBsZXZlbCBUaGUgbGV2ZWwgb2YgdGhlIG5vdGlmaWNhdGlvbiB3aGljaCBkZWZpbmVzIGhvdyB0aGUgbWVzc2FnZSB3aWxsIGJlIGRpc3BsYXllZCwgc3VjaCBhcyB0aGUgaWNvbi5cclxuICAgICAqIEVSUk9SOiBOb3RpZmljYXRpb24gd2lsbCB1c2UgdGhlIHN5c3RlbSBlcnJvciBpY29uLlxyXG4gICAgICogV0FSTklORzogTm90aWZpY2F0aW9uIHdpbGwgdXNlIHRoZSBzeXN0ZW0gd2FybmluZyBpY29uLlxyXG4gICAgICogSU5GTzogTm90aWZpY2F0aW9uIHdpbGwgdXNlIHRoZSBzeXN0ZW0gaW5mbyBpY29uLlxyXG4gICAgICogQHBhcmFtIHVuaXF1ZUlkIFVuaXF1ZSBpZGVudGlmaWVyIGZvciB0aGUgbm90aWZpY2F0aW9uIHdoaWNoIGlzIHVzZWQgd2l0aCBjbGVhckZvcm1Ob3RpZmljYXRpb24gdG8gcmVtb3ZlIHRoZSBub3RpZmljYXRpb24uXHJcbiAgICAgKiBAcmV0dXJucyB0cnVlIGlmIGl0IHN1Y2NlZWRzLCBvdGhlbnByd2lzZSBmYWxzZS5cclxuICAgICAqL1xyXG4gICAgc3RhdGljIGFkZEZvcm1Ob3RpZmljYXRpb24oXHJcbiAgICAgIG1lc3NhZ2U6IHN0cmluZyxcclxuICAgICAgbGV2ZWw6IFhybS5Gb3JtTm90aWZpY2F0aW9uTGV2ZWwsXHJcbiAgICAgIHVuaXF1ZUlkOiBzdHJpbmdcclxuICAgICkge1xyXG4gICAgICB0cnkge1xyXG4gICAgICAgIHJldHVybiBGb3JtLmZvcm1Db250ZXh0LnVpLnNldEZvcm1Ob3RpZmljYXRpb24oXHJcbiAgICAgICAgICBtZXNzYWdlLFxyXG4gICAgICAgICAgbGV2ZWwsXHJcbiAgICAgICAgICB1bmlxdWVJZFxyXG4gICAgICAgICk7XHJcbiAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFhybUV4LiR7WHJtRXguZ2V0RnVuY3Rpb25OYW1lKCl9OlxcbiR7ZXJyb3IubWVzc2FnZX1gKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgLyoqXHJcbiAgICAgKiBDbGVhcnMgdGhlIGZvcm0gbm90aWZpY2F0aW9uIGRlc2NyaWJlZCBieSB1bmlxdWVJZC5cclxuICAgICAqIEBwYXJhbSB1bmlxdWVJZCBVbmlxdWUgaWRlbnRpZmllci5cclxuICAgICAqIEByZXR1cm5zIFRydWUgaWYgaXQgc3VjY2VlZHMsIG90aGVyd2lzZSBmYWxzZS5cclxuICAgICAqL1xyXG4gICAgc3RhdGljIHJlbW92ZUZvcm1Ob3RpZmljYXRpb24odW5pcXVlSWQ6IHN0cmluZykge1xyXG4gICAgICB0cnkge1xyXG4gICAgICAgIHJldHVybiBGb3JtLmZvcm1Db250ZXh0LnVpLmNsZWFyRm9ybU5vdGlmaWNhdGlvbih1bmlxdWVJZCk7XHJcbiAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFhybUV4LiR7WHJtRXguZ2V0RnVuY3Rpb25OYW1lKCl9OlxcbiR7ZXJyb3IubWVzc2FnZX1gKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgLyoqXHJcbiAgICAgKiBBZGRzIGEgaGFuZGxlciB0byBiZSBjYWxsZWQgd2hlbiB0aGUgcmVjb3JkIGlzIHNhdmVkLlxyXG4gICAgICovXHJcbiAgICBzdGF0aWMgYWRkT25TYXZlKFxyXG4gICAgICBoYW5kbGVyczpcclxuICAgICAgICB8IFhybS5FdmVudHMuQ29udGV4dFNlbnNpdGl2ZUhhbmRsZXJcclxuICAgICAgICB8IFhybS5FdmVudHMuQ29udGV4dFNlbnNpdGl2ZUhhbmRsZXJbXVxyXG4gICAgKSB7XHJcbiAgICAgIHRyeSB7XHJcbiAgICAgICAgaWYgKCFBcnJheS5pc0FycmF5KGhhbmRsZXJzKSkge1xyXG4gICAgICAgICAgaGFuZGxlcnMgPSBbaGFuZGxlcnNdO1xyXG4gICAgICAgIH1cclxuICAgICAgICBoYW5kbGVycy5mb3JFYWNoKChoYW5kbGVyKSA9PiB7XHJcbiAgICAgICAgICBpZiAodHlwZW9mIGhhbmRsZXIgIT09IFwiZnVuY3Rpb25cIikge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYCcke2hhbmRsZXJ9JyBpcyBub3QgYSBmdW5jdGlvbmApO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgRm9ybS5mb3JtQ29udGV4dC5kYXRhLmVudGl0eS5yZW1vdmVPblNhdmUoaGFuZGxlcik7XHJcbiAgICAgICAgICBGb3JtLmZvcm1Db250ZXh0LmRhdGEuZW50aXR5LmFkZE9uU2F2ZShoYW5kbGVyKTtcclxuICAgICAgICB9KTtcclxuICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgWHJtRXguJHtYcm1FeC5nZXRGdW5jdGlvbk5hbWUoKX06XFxuJHtlcnJvci5tZXNzYWdlfWApO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgICAvKipcclxuICAgICAqIEFkZHMgYSBmdW5jdGlvbiB0byBiZSBjYWxsZWQgYWZ0ZXIgdGhlIE9uU2F2ZSBpcyBjb21wbGV0ZS5cclxuICAgICAqIEBwYXJhbSBoYW5kbGVyIFRoZSBoYW5kbGVyLlxyXG4gICAgICogQHJlbWFya3MgQWRkZWQgaW4gOS4yXHJcbiAgICAgKiBAc2VlIHtAbGluayBodHRwczovL2RvY3MubWljcm9zb2Z0LmNvbS9lbi11cy9wb3dlcmFwcHMvZGV2ZWxvcGVyL21vZGVsLWRyaXZlbi1hcHBzL2NsaWVudGFwaS9yZWZlcmVuY2UvZXZlbnRzL3Bvc3RzYXZlIEV4dGVybmFsIExpbms6IFBvc3RTYXZlIEV2ZW50IERvY3VtZW50YXRpb259XHJcbiAgICAgKi9cclxuICAgIHN0YXRpYyBhZGRPblBvc3RTYXZlKFxyXG4gICAgICBoYW5kbGVyczpcclxuICAgICAgICB8IFhybS5FdmVudHMuQ29udGV4dFNlbnNpdGl2ZUhhbmRsZXJcclxuICAgICAgICB8IFhybS5FdmVudHMuQ29udGV4dFNlbnNpdGl2ZUhhbmRsZXJbXVxyXG4gICAgKSB7XHJcbiAgICAgIHRyeSB7XHJcbiAgICAgICAgaWYgKCFBcnJheS5pc0FycmF5KGhhbmRsZXJzKSkge1xyXG4gICAgICAgICAgaGFuZGxlcnMgPSBbaGFuZGxlcnNdO1xyXG4gICAgICAgIH1cclxuICAgICAgICBoYW5kbGVycy5mb3JFYWNoKChoYW5kbGVyKSA9PiB7XHJcbiAgICAgICAgICBpZiAodHlwZW9mIGhhbmRsZXIgIT09IFwiZnVuY3Rpb25cIikge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYCcke2hhbmRsZXJ9JyBpcyBub3QgYSBmdW5jdGlvbmApO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgRm9ybS5mb3JtQ29udGV4dC5kYXRhLmVudGl0eS5yZW1vdmVPblBvc3RTYXZlKGhhbmRsZXIpO1xyXG4gICAgICAgICAgRm9ybS5mb3JtQ29udGV4dC5kYXRhLmVudGl0eS5hZGRPblBvc3RTYXZlKGhhbmRsZXIpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBYcm1FeC4ke1hybUV4LmdldEZ1bmN0aW9uTmFtZSgpfTpcXG4ke2Vycm9yLm1lc3NhZ2V9YCk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICAgIC8qKlxyXG4gICAgICogQWRkcyBhIGZ1bmN0aW9uIHRvIGJlIGNhbGxlZCB3aGVuIGZvcm0gZGF0YSBpcyBsb2FkZWQuXHJcbiAgICAgKiBAcGFyYW0gaGFuZGxlciBUaGUgZnVuY3Rpb24gdG8gYmUgZXhlY3V0ZWQgd2hlbiB0aGUgZm9ybSBkYXRhIGxvYWRzLiBUaGUgZnVuY3Rpb24gd2lsbCBiZSBhZGRlZCB0byB0aGUgYm90dG9tIG9mIHRoZSBldmVudCBoYW5kbGVyIHBpcGVsaW5lLlxyXG4gICAgICovXHJcbiAgICBzdGF0aWMgYWRkT25Mb2FkKFxyXG4gICAgICBoYW5kbGVyczpcclxuICAgICAgICB8IFhybS5FdmVudHMuQ29udGV4dFNlbnNpdGl2ZUhhbmRsZXJcclxuICAgICAgICB8IFhybS5FdmVudHMuQ29udGV4dFNlbnNpdGl2ZUhhbmRsZXJbXVxyXG4gICAgKSB7XHJcbiAgICAgIHRyeSB7XHJcbiAgICAgICAgaWYgKCFBcnJheS5pc0FycmF5KGhhbmRsZXJzKSkge1xyXG4gICAgICAgICAgaGFuZGxlcnMgPSBbaGFuZGxlcnNdO1xyXG4gICAgICAgIH1cclxuICAgICAgICBoYW5kbGVycy5mb3JFYWNoKChoYW5kbGVyKSA9PiB7XHJcbiAgICAgICAgICBpZiAodHlwZW9mIGhhbmRsZXIgIT09IFwiZnVuY3Rpb25cIikge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYCcke2hhbmRsZXJ9JyBpcyBub3QgYSBmdW5jdGlvbmApO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgRm9ybS5mb3JtQ29udGV4dC5kYXRhLnJlbW92ZU9uTG9hZChoYW5kbGVyKTtcclxuICAgICAgICAgIEZvcm0uZm9ybUNvbnRleHQuZGF0YS5hZGRPbkxvYWQoaGFuZGxlcik7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFhybUV4LiR7WHJtRXguZ2V0RnVuY3Rpb25OYW1lKCl9OlxcbiR7ZXJyb3IubWVzc2FnZX1gKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgLyoqXHJcbiAgICAgKiBBZGRzIGEgaGFuZGxlciB0byBiZSBjYWxsZWQgd2hlbiB0aGUgYXR0cmlidXRlJ3MgdmFsdWUgaXMgY2hhbmdlZC5cclxuICAgICAqIEBwYXJhbSBoYW5kbGVyIFRoZSBmdW5jdGlvbiByZWZlcmVuY2UuXHJcbiAgICAgKi9cclxuICAgIHN0YXRpYyBhZGRPbkNoYW5nZShcclxuICAgICAgZmllbGRzOiBDbGFzcy5GaWVsZFtdLFxyXG4gICAgICBoYW5kbGVyczpcclxuICAgICAgICB8IFhybS5FdmVudHMuQ29udGV4dFNlbnNpdGl2ZUhhbmRsZXJcclxuICAgICAgICB8IFhybS5FdmVudHMuQ29udGV4dFNlbnNpdGl2ZUhhbmRsZXJbXSxcclxuICAgICAgZXhlY3V0ZT86IGJvb2xlYW5cclxuICAgICkge1xyXG4gICAgICB0cnkge1xyXG4gICAgICAgIGlmICghQXJyYXkuaXNBcnJheShoYW5kbGVycykpIHtcclxuICAgICAgICAgIGhhbmRsZXJzID0gW2hhbmRsZXJzXTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaGFuZGxlcnMuZm9yRWFjaCgoaGFuZGxlcikgPT4ge1xyXG4gICAgICAgICAgaWYgKHR5cGVvZiBoYW5kbGVyICE9PSBcImZ1bmN0aW9uXCIpIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGAnJHtoYW5kbGVyfScgaXMgbm90IGEgZnVuY3Rpb25gKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICAgIGZpZWxkcy5mb3JFYWNoKChmaWVsZCkgPT4ge1xyXG4gICAgICAgICAgICBmaWVsZC5yZW1vdmVPbkNoYW5nZShoYW5kbGVyKTtcclxuICAgICAgICAgICAgZmllbGQuYWRkT25DaGFuZ2UoaGFuZGxlcik7XHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICB9KTtcclxuICAgICAgICBpZiAoZXhlY3V0ZSkge1xyXG4gICAgICAgICAgZmllbGRzLmZvckVhY2goKGZpZWxkKSA9PiB7XHJcbiAgICAgICAgICAgIGZpZWxkLkF0dHJpYnV0ZS5maXJlT25DaGFuZ2UoKTtcclxuICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgWHJtRXguJHtYcm1FeC5nZXRGdW5jdGlvbk5hbWUoKX06XFxuJHtlcnJvci5tZXNzYWdlfWApO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBleHBvcnQgbmFtZXNwYWNlIENsYXNzIHtcclxuICAgIC8qKlxyXG4gICAgICogVXNlZCB0byBleGVjdXRlIG1ldGhvZHMgcmVsYXRlZCB0byBhIHNpbmdsZSBBdHRyaWJ1dGVcclxuICAgICAqL1xyXG4gICAgZXhwb3J0IGNsYXNzIEZpZWxkIGltcGxlbWVudHMgWHJtLkF0dHJpYnV0ZXMuQXR0cmlidXRlIHtcclxuICAgICAgcHVibGljIHN0YXRpYyBhbGxGaWVsZHM6IEZpZWxkW10gPSBbXTtcclxuXHJcbiAgICAgIHB1YmxpYyByZWFkb25seSBOYW1lITogc3RyaW5nO1xyXG4gICAgICBwcm90ZWN0ZWQgX2F0dHJpYnV0ZT86IFhybS5BdHRyaWJ1dGVzLkF0dHJpYnV0ZTtcclxuXHJcbiAgICAgIGNvbnN0cnVjdG9yKGF0dHJpYnV0ZU5hbWU6IHN0cmluZykge1xyXG4gICAgICAgIGNvbnN0IGV4aXN0aW5nRmllbGQgPSBGaWVsZC5hbGxGaWVsZHMuZmluZChcclxuICAgICAgICAgIChmKSA9PiBmLk5hbWUgPT09IGF0dHJpYnV0ZU5hbWVcclxuICAgICAgICApO1xyXG4gICAgICAgIGlmIChleGlzdGluZ0ZpZWxkKSB7XHJcbiAgICAgICAgICByZXR1cm4gZXhpc3RpbmdGaWVsZDtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5OYW1lID0gYXR0cmlidXRlTmFtZTtcclxuICAgICAgICBGaWVsZC5hbGxGaWVsZHMucHVzaCh0aGlzKTtcclxuICAgICAgfVxyXG4gICAgICBzZXRWYWx1ZSh2YWx1ZTogYW55KTogdm9pZCB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuQXR0cmlidXRlLnNldFZhbHVlKHZhbHVlKTtcclxuICAgICAgfVxyXG4gICAgICBnZXRBdHRyaWJ1dGVUeXBlKCk6IFhybS5BdHRyaWJ1dGVzLkF0dHJpYnV0ZVR5cGUge1xyXG4gICAgICAgIHJldHVybiB0aGlzLkF0dHJpYnV0ZS5nZXRBdHRyaWJ1dGVUeXBlKCk7XHJcbiAgICAgIH1cclxuICAgICAgZ2V0Rm9ybWF0KCk6IFhybS5BdHRyaWJ1dGVzLkF0dHJpYnV0ZUZvcm1hdCB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuQXR0cmlidXRlLmdldEZvcm1hdCgpO1xyXG4gICAgICB9XHJcbiAgICAgIGdldElzRGlydHkoKTogYm9vbGVhbiB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuQXR0cmlidXRlLmdldElzRGlydHkoKTtcclxuICAgICAgfVxyXG4gICAgICBnZXROYW1lKCk6IHN0cmluZyB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuQXR0cmlidXRlLmdldE5hbWUoKTtcclxuICAgICAgfVxyXG4gICAgICBnZXRQYXJlbnQoKTogWHJtLkVudGl0eSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuQXR0cmlidXRlLmdldFBhcmVudCgpO1xyXG4gICAgICB9XHJcbiAgICAgIGdldFJlcXVpcmVkTGV2ZWwoKTogWHJtLkF0dHJpYnV0ZXMuUmVxdWlyZW1lbnRMZXZlbCB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuQXR0cmlidXRlLmdldFJlcXVpcmVkTGV2ZWwoKTtcclxuICAgICAgfVxyXG4gICAgICBnZXRTdWJtaXRNb2RlKCk6IFhybS5TdWJtaXRNb2RlIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5BdHRyaWJ1dGUuZ2V0U3VibWl0TW9kZSgpO1xyXG4gICAgICB9XHJcbiAgICAgIGdldFVzZXJQcml2aWxlZ2UoKTogWHJtLlByaXZpbGVnZSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuQXR0cmlidXRlLmdldFVzZXJQcml2aWxlZ2UoKTtcclxuICAgICAgfVxyXG4gICAgICByZW1vdmVPbkNoYW5nZShoYW5kbGVyOiBYcm0uRXZlbnRzLkF0dHJpYnV0ZS5DaGFuZ2VFdmVudEhhbmRsZXIpOiB2b2lkIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5BdHRyaWJ1dGUucmVtb3ZlT25DaGFuZ2UoaGFuZGxlcik7XHJcbiAgICAgIH1cclxuICAgICAgc2V0U3VibWl0TW9kZShzdWJtaXRNb2RlOiBYcm0uU3VibWl0TW9kZSk6IHZvaWQge1xyXG4gICAgICAgIHJldHVybiB0aGlzLkF0dHJpYnV0ZS5zZXRTdWJtaXRNb2RlKHN1Ym1pdE1vZGUpO1xyXG4gICAgICB9XHJcbiAgICAgIGdldFZhbHVlKCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLkF0dHJpYnV0ZS5nZXRWYWx1ZSgpO1xyXG4gICAgICB9XHJcbiAgICAgIHNldElzVmFsaWQoaXNWYWxpZDogYm9vbGVhbiwgbWVzc2FnZT86IHN0cmluZyk6IHZvaWQge1xyXG4gICAgICAgIHJldHVybiB0aGlzLkF0dHJpYnV0ZS5zZXRJc1ZhbGlkKGlzVmFsaWQsIG1lc3NhZ2UpO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBwdWJsaWMgZ2V0IEF0dHJpYnV0ZSgpOiBYcm0uQXR0cmlidXRlcy5BdHRyaWJ1dGUge1xyXG4gICAgICAgIHJldHVybiAodGhpcy5fYXR0cmlidXRlID8/PVxyXG4gICAgICAgICAgRm9ybS5mb3JtQ29udGV4dC5nZXRBdHRyaWJ1dGUodGhpcy5OYW1lKSA/P1xyXG4gICAgICAgICAgWHJtRXgudGhyb3dFcnJvcihcclxuICAgICAgICAgICAgYFRoZSBhdHRyaWJ1dGUgJyR7dGhpcy5OYW1lfScgd2FzIG5vdCBmb3VuZCBvbiB0aGUgZm9ybS5gXHJcbiAgICAgICAgICApKTtcclxuICAgICAgfVxyXG5cclxuICAgICAgcHVibGljIGdldCBjb250cm9scygpOiBYcm0uQ29sbGVjdGlvbi5JdGVtQ29sbGVjdGlvbjxYcm0uQ29udHJvbHMuU3RhbmRhcmRDb250cm9sPiB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuQXR0cmlidXRlLmNvbnRyb2xzO1xyXG4gICAgICB9XHJcblxyXG4gICAgICAvKipcclxuICAgICAgICogR2V0cyB0aGUgdmFsdWUuXHJcbiAgICAgICAqIEByZXR1cm5zIFRoZSB2YWx1ZS5cclxuICAgICAgICovXHJcbiAgICAgIHB1YmxpYyBnZXQgVmFsdWUoKTogYW55IHtcclxuICAgICAgICByZXR1cm4gdGhpcy5BdHRyaWJ1dGUuZ2V0VmFsdWUoKTtcclxuICAgICAgfVxyXG5cclxuICAgICAgcHVibGljIHNldCBWYWx1ZSh2YWx1ZTogYW55KSB7XHJcbiAgICAgICAgdGhpcy5BdHRyaWJ1dGUuc2V0VmFsdWUodmFsdWUpO1xyXG4gICAgICB9XHJcblxyXG4gICAgICAvKipcclxuICAgICAgICogU2V0cyBhIGNvbnRyb2wtbG9jYWwgbm90aWZpY2F0aW9uIG1lc3NhZ2UuXHJcbiAgICAgICAqIEBwYXJhbSBtZXNzYWdlIFRoZSBtZXNzYWdlLlxyXG4gICAgICAgKiBAcGFyYW0gdW5pcXVlSWQgVW5pcXVlIGlkZW50aWZpZXIuXHJcbiAgICAgICAqIEByZXR1cm5zIHRydWUgaWYgaXQgc3VjY2VlZHMsIGZhbHNlIGlmIGl0IGZhaWxzLlxyXG4gICAgICAgKiBAcmVtYXJrcyAgICAgV2hlbiB0aGlzIG1ldGhvZCBpcyB1c2VkIG9uIE1pY3Jvc29mdCBEeW5hbWljcyBDUk0gZm9yIHRhYmxldHMgYSByZWQgXCJYXCIgaWNvblxyXG4gICAgICAgKiAgICAgICAgICAgICAgYXBwZWFycyBuZXh0IHRvIHRoZSBjb250cm9sLiBUYXBwaW5nIG9uIHRoZSBpY29uIHdpbGwgZGlzcGxheSB0aGUgbWVzc2FnZS5cclxuICAgICAgICovXHJcbiAgICAgIHB1YmxpYyBzZXROb3RpZmljYXRpb24obWVzc2FnZTogc3RyaW5nLCB1bmlxdWVJZDogc3RyaW5nKTogdGhpcyB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgIGlmICghbWVzc2FnZSkgdGhyb3cgbmV3IEVycm9yKGBubyBtZXNzYWdlIHdhcyBwcm92aWRlZC5gKTtcclxuICAgICAgICAgIGlmICghdW5pcXVlSWQpIHRocm93IG5ldyBFcnJvcihgbm8gdW5pcXVlSWQgd2FzIHByb3ZpZGVkLmApO1xyXG4gICAgICAgICAgdGhpcy5jb250cm9scy5mb3JFYWNoKChjb250cm9sKSA9PlxyXG4gICAgICAgICAgICBjb250cm9sLnNldE5vdGlmaWNhdGlvbihtZXNzYWdlLCB1bmlxdWVJZClcclxuICAgICAgICAgICk7XHJcbiAgICAgICAgICByZXR1cm4gdGhpcztcclxuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XHJcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXHJcbiAgICAgICAgICAgIGBYcm1FeC4ke1hybUV4LmdldEZ1bmN0aW9uTmFtZSgpfTpcXG4ke2Vycm9yLm1lc3NhZ2V9YFxyXG4gICAgICAgICAgKTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIC8qKlxyXG4gICAgICAgKiBTZXRzIHRoZSB2aXNpYmlsaXR5IHN0YXRlLlxyXG4gICAgICAgKiBAcGFyYW0gdmlzaWJsZSB0cnVlIHRvIHNob3csIGZhbHNlIHRvIGhpZGUuXHJcbiAgICAgICAqL1xyXG4gICAgICBwdWJsaWMgc2V0VmlzaWJsZSh2aXNpYmxlOiBib29sZWFuKTogdGhpcyB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgIHRoaXMuY29udHJvbHMuZm9yRWFjaCgoY29udHJvbCkgPT4gY29udHJvbC5zZXRWaXNpYmxlKHZpc2libGUpKTtcclxuICAgICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcclxuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcclxuICAgICAgICAgICAgYFhybUV4LiR7WHJtRXguZ2V0RnVuY3Rpb25OYW1lKCl9OlxcbiR7ZXJyb3IubWVzc2FnZX1gXHJcbiAgICAgICAgICApO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG5cclxuICAgICAgLyoqXHJcbiAgICAgICAqIFNldHMgdGhlIHN0YXRlIG9mIHRoZSBjb250cm9sIHRvIGVpdGhlciBlbmFibGVkLCBvciBkaXNhYmxlZC5cclxuICAgICAgICogQHBhcmFtIGRpc2FibGVkIHRydWUgdG8gZGlzYWJsZSwgZmFsc2UgdG8gZW5hYmxlLlxyXG4gICAgICAgKi9cclxuICAgICAgcHVibGljIHNldERpc2FibGVkKGRpc2FibGVkOiBib29sZWFuKTogdGhpcyB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgIHRoaXMuY29udHJvbHMuZm9yRWFjaCgoY29udHJvbCkgPT4gY29udHJvbC5zZXREaXNhYmxlZChkaXNhYmxlZCkpO1xyXG4gICAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xyXG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxyXG4gICAgICAgICAgICBgWHJtRXguJHtYcm1FeC5nZXRGdW5jdGlvbk5hbWUoKX06XFxuJHtlcnJvci5tZXNzYWdlfWBcclxuICAgICAgICAgICk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcblxyXG4gICAgICAvKipcclxuICAgICAgICogU2V0cyB0aGUgcmVxdWlyZWQgbGV2ZWwuXHJcbiAgICAgICAqIEBwYXJhbSByZXF1aXJlbWVudExldmVsIFRoZSByZXF1aXJlbWVudCBsZXZlbCwgYXMgZWl0aGVyIFwibm9uZVwiLCBcInJlcXVpcmVkXCIsIG9yIFwicmVjb21tZW5kZWRcIlxyXG4gICAgICAgKi9cclxuICAgICAgcHVibGljIHNldFJlcXVpcmVkTGV2ZWwoXHJcbiAgICAgICAgcmVxdWlyZW1lbnRMZXZlbDogWHJtLkF0dHJpYnV0ZXMuUmVxdWlyZW1lbnRMZXZlbFxyXG4gICAgICApOiB0aGlzIHtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgdGhpcy5BdHRyaWJ1dGUuc2V0UmVxdWlyZWRMZXZlbChyZXF1aXJlbWVudExldmVsKTtcclxuICAgICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcclxuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcclxuICAgICAgICAgICAgYFhybUV4LiR7WHJtRXguZ2V0RnVuY3Rpb25OYW1lKCl9OlxcbiR7ZXJyb3IubWVzc2FnZX1gXHJcbiAgICAgICAgICApO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG5cclxuICAgICAgLyoqXHJcbiAgICAgICAqIFNldHMgdGhlIHJlcXVpcmVkIGxldmVsLlxyXG4gICAgICAgKiBAcGFyYW0gcmVxdWlyZWQgVGhlIHJlcXVpcmVtZW50IGxldmVsLCBhcyBlaXRoZXIgZmFsc2UgZm9yIFwibm9uZVwiIG9yIHRydWUgZm9yIFwicmVxdWlyZWRcIlxyXG4gICAgICAgKi9cclxuICAgICAgcHVibGljIHNldFJlcXVpcmVkKHJlcXVpcmVkOiBib29sZWFuKTogdGhpcyB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgIHRoaXMuQXR0cmlidXRlLnNldFJlcXVpcmVkTGV2ZWwocmVxdWlyZWQgPyBcInJlcXVpcmVkXCIgOiBcIm5vbmVcIik7XHJcbiAgICAgICAgICByZXR1cm4gdGhpcztcclxuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XHJcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXHJcbiAgICAgICAgICAgIGBYcm1FeC4ke1hybUV4LmdldEZ1bmN0aW9uTmFtZSgpfTpcXG4ke2Vycm9yLm1lc3NhZ2V9YFxyXG4gICAgICAgICAgKTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIC8qKkZpcmUgYWxsIFwib24gY2hhbmdlXCIgZXZlbnQgaGFuZGxlcnMuICovXHJcbiAgICAgIHB1YmxpYyBmaXJlT25DaGFuZ2UoKTogdGhpcyB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgIHRoaXMuQXR0cmlidXRlLmZpcmVPbkNoYW5nZSgpO1xyXG4gICAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xyXG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxyXG4gICAgICAgICAgICBgWHJtRXguJHtYcm1FeC5nZXRGdW5jdGlvbk5hbWUoKX06XFxuJHtlcnJvci5tZXNzYWdlfWBcclxuICAgICAgICAgICk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcblxyXG4gICAgICAvKipcclxuICAgICAgICogQWRkcyBhIGhhbmRsZXIgb3IgYW4gYXJyYXkgb2YgaGFuZGxlcnMgdG8gYmUgY2FsbGVkIHdoZW4gdGhlIGF0dHJpYnV0ZSdzIHZhbHVlIGlzIGNoYW5nZWQuXHJcbiAgICAgICAqIEBwYXJhbSBoYW5kbGVycyBUaGUgZnVuY3Rpb24gcmVmZXJlbmNlIG9yIGFuIGFycmF5IG9mIGZ1bmN0aW9uIHJlZmVyZW5jZXMuXHJcbiAgICAgICAqL1xyXG4gICAgICBwdWJsaWMgYWRkT25DaGFuZ2UoXHJcbiAgICAgICAgaGFuZGxlcnM6XHJcbiAgICAgICAgICB8IFhybS5FdmVudHMuQ29udGV4dFNlbnNpdGl2ZUhhbmRsZXJcclxuICAgICAgICAgIHwgWHJtLkV2ZW50cy5Db250ZXh0U2Vuc2l0aXZlSGFuZGxlcltdXHJcbiAgICAgICk6IHRoaXMge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShoYW5kbGVycykpIHtcclxuICAgICAgICAgICAgZm9yIChjb25zdCBoYW5kbGVyIG9mIGhhbmRsZXJzKSB7XHJcbiAgICAgICAgICAgICAgaWYgKHR5cGVvZiBoYW5kbGVyICE9PSBcImZ1bmN0aW9uXCIpXHJcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYCcke2hhbmRsZXJ9JyBpcyBub3QgYSBmdW5jdGlvbmApO1xyXG4gICAgICAgICAgICAgIHRoaXMuQXR0cmlidXRlLnJlbW92ZU9uQ2hhbmdlKGhhbmRsZXIpO1xyXG4gICAgICAgICAgICAgIHRoaXMuQXR0cmlidXRlLmFkZE9uQ2hhbmdlKGhhbmRsZXIpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBpZiAodHlwZW9mIGhhbmRsZXJzICE9PSBcImZ1bmN0aW9uXCIpXHJcbiAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGAnJHtoYW5kbGVyc30nIGlzIG5vdCBhIGZ1bmN0aW9uYCk7XHJcbiAgICAgICAgICAgIHRoaXMuQXR0cmlidXRlLnJlbW92ZU9uQ2hhbmdlKGhhbmRsZXJzKTtcclxuICAgICAgICAgICAgdGhpcy5BdHRyaWJ1dGUuYWRkT25DaGFuZ2UoaGFuZGxlcnMpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xyXG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxyXG4gICAgICAgICAgICBgWHJtRXguJHtYcm1FeC5nZXRGdW5jdGlvbk5hbWUoKX06XFxuJHtlcnJvci5tZXNzYWdlfWBcclxuICAgICAgICAgICk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcblxyXG4gICAgICAvKipcclxuICAgICAgICogRGlzcGxheXMgYW4gZXJyb3Igb3IgcmVjb21tZW5kYXRpb24gbm90aWZpY2F0aW9uIGZvciBhIGNvbnRyb2wsIGFuZCBsZXRzIHlvdSBzcGVjaWZ5IGFjdGlvbnMgdG8gZXhlY3V0ZSBiYXNlZCBvbiB0aGUgbm90aWZpY2F0aW9uLlxyXG4gICAgICAgKi9cclxuICAgICAgcHVibGljIGFkZE5vdGlmaWNhdGlvbihcclxuICAgICAgICBtZXNzYWdlOiBzdHJpbmcsXHJcbiAgICAgICAgbm90aWZpY2F0aW9uTGV2ZWw6IFwiRVJST1JcIiB8IFwiUkVDT01NRU5EQVRJT05cIixcclxuICAgICAgICB1bmlxdWVJZDogc3RyaW5nLFxyXG4gICAgICAgIGFjdGlvbnM/OiBYcm0uQ29udHJvbHMuQ29udHJvbE5vdGlmaWNhdGlvbkFjdGlvbltdXHJcbiAgICAgICk6IHRoaXMge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICBpZiAoIXVuaXF1ZUlkKSB0aHJvdyBuZXcgRXJyb3IoYG5vIHVuaXF1ZUlkIHdhcyBwcm92aWRlZC5gKTtcclxuICAgICAgICAgIGlmIChhY3Rpb25zICYmICFBcnJheS5pc0FycmF5KGFjdGlvbnMpKVxyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXHJcbiAgICAgICAgICAgICAgYHRoZSBhY3Rpb24gcGFyYW1ldGVyIGlzIG5vdCBhbiBhcnJheSBvZiBDb250cm9sTm90aWZpY2F0aW9uQWN0aW9uYFxyXG4gICAgICAgICAgICApO1xyXG4gICAgICAgICAgdGhpcy5jb250cm9scy5mb3JFYWNoKChjb250cm9sKSA9PiB7XHJcbiAgICAgICAgICAgIGNvbnRyb2wuYWRkTm90aWZpY2F0aW9uKHtcclxuICAgICAgICAgICAgICBtZXNzYWdlczogW21lc3NhZ2VdLFxyXG4gICAgICAgICAgICAgIG5vdGlmaWNhdGlvbkxldmVsOiBub3RpZmljYXRpb25MZXZlbCxcclxuICAgICAgICAgICAgICB1bmlxdWVJZDogdW5pcXVlSWQsXHJcbiAgICAgICAgICAgICAgYWN0aW9uczogYWN0aW9ucyxcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcclxuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcclxuICAgICAgICAgICAgYFhybUV4LiR7WHJtRXguZ2V0RnVuY3Rpb25OYW1lKCl9OlxcbiR7ZXJyb3IubWVzc2FnZX1gXHJcbiAgICAgICAgICApO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgICAvKipcclxuICAgICAgICogQ2xlYXJzIHRoZSBub3RpZmljYXRpb24gaWRlbnRpZmllZCBieSB1bmlxdWVJZC5cclxuICAgICAgICogQHBhcmFtIHVuaXF1ZUlkIChPcHRpb25hbCkgVW5pcXVlIGlkZW50aWZpZXIuXHJcbiAgICAgICAqIEByZXR1cm5zIHRydWUgaWYgaXQgc3VjY2VlZHMsIGZhbHNlIGlmIGl0IGZhaWxzLlxyXG4gICAgICAgKiBAcmVtYXJrcyBJZiB0aGUgdW5pcXVlSWQgcGFyYW1ldGVyIGlzIG5vdCB1c2VkLCB0aGUgY3VycmVudCBub3RpZmljYXRpb24gc2hvd24gd2lsbCBiZSByZW1vdmVkLlxyXG4gICAgICAgKi9cclxuICAgICAgcmVtb3ZlTm90aWZpY2F0aW9uKHVuaXF1ZUlkOiBzdHJpbmcpOiB0aGlzIHtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgdGhpcy5jb250cm9scy5mb3JFYWNoKChjb250cm9sKSA9PiB7XHJcbiAgICAgICAgICAgIGNvbnRyb2wuY2xlYXJOb3RpZmljYXRpb24odW5pcXVlSWQpO1xyXG4gICAgICAgICAgfSk7XHJcbiAgICAgICAgICByZXR1cm4gdGhpcztcclxuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XHJcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXHJcbiAgICAgICAgICAgIGBYcm1FeC4ke1hybUV4LmdldEZ1bmN0aW9uTmFtZSgpfTpcXG4ke2Vycm9yLm1lc3NhZ2V9YFxyXG4gICAgICAgICAgKTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH1cclxuICAgIGV4cG9ydCBjbGFzcyBUZXh0RmllbGRcclxuICAgICAgZXh0ZW5kcyBGaWVsZFxyXG4gICAgICBpbXBsZW1lbnRzIFhybS5BdHRyaWJ1dGVzLlN0cmluZ0F0dHJpYnV0ZVxyXG4gICAge1xyXG4gICAgICBwcm90ZWN0ZWQgZGVjbGFyZSBfYXR0cmlidXRlOiBYcm0uQXR0cmlidXRlcy5TdHJpbmdBdHRyaWJ1dGU7XHJcbiAgICAgIGNvbnN0cnVjdG9yKGF0dHJpYnV0ZTogc3RyaW5nKSB7XHJcbiAgICAgICAgc3VwZXIoYXR0cmlidXRlKTtcclxuICAgICAgfVxyXG4gICAgICBnZXRNYXhMZW5ndGgoKTogbnVtYmVyIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5BdHRyaWJ1dGUuZ2V0TWF4TGVuZ3RoKCk7XHJcbiAgICAgIH1cclxuICAgICAgZ2V0Rm9ybWF0KCk6IFhybS5BdHRyaWJ1dGVzLlN0cmluZ0F0dHJpYnV0ZUZvcm1hdCB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuQXR0cmlidXRlLmdldEZvcm1hdCgpIGFzIFhybS5BdHRyaWJ1dGVzLlN0cmluZ0F0dHJpYnV0ZUZvcm1hdDtcclxuICAgICAgfVxyXG4gICAgICBnZXQgQXR0cmlidXRlKCkge1xyXG4gICAgICAgIHJldHVybiAodGhpcy5fYXR0cmlidXRlID8/PVxyXG4gICAgICAgICAgRm9ybS5mb3JtQ29udGV4dC5nZXRBdHRyaWJ1dGUodGhpcy5OYW1lKSA/P1xyXG4gICAgICAgICAgWHJtRXgudGhyb3dFcnJvcihgRmllbGQgJyR7dGhpcy5OYW1lfScgZG9lcyBub3QgZXhpc3RgKSk7XHJcbiAgICAgIH1cclxuICAgICAgZ2V0IGNvbnRyb2xzKCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLkF0dHJpYnV0ZS5jb250cm9scztcclxuICAgICAgfVxyXG4gICAgICBnZXQgVmFsdWUoKTogc3RyaW5nIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5BdHRyaWJ1dGUuZ2V0VmFsdWUoKSA/PyBudWxsO1xyXG4gICAgICB9XHJcbiAgICAgIHNldCBWYWx1ZSh2YWx1ZTogc3RyaW5nKSB7XHJcbiAgICAgICAgdGhpcy5BdHRyaWJ1dGUuc2V0VmFsdWUodmFsdWUpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgICBleHBvcnQgY2xhc3MgTnVtYmVyRmllbGRcclxuICAgICAgZXh0ZW5kcyBGaWVsZFxyXG4gICAgICBpbXBsZW1lbnRzIFhybS5BdHRyaWJ1dGVzLk51bWJlckF0dHJpYnV0ZVxyXG4gICAge1xyXG4gICAgICBwcm90ZWN0ZWQgZGVjbGFyZSBfYXR0cmlidXRlOiBYcm0uQXR0cmlidXRlcy5OdW1iZXJBdHRyaWJ1dGU7XHJcbiAgICAgIGNvbnN0cnVjdG9yKGF0dHJpYnV0ZTogc3RyaW5nKSB7XHJcbiAgICAgICAgc3VwZXIoYXR0cmlidXRlKTtcclxuICAgICAgfVxyXG4gICAgICBnZXRGb3JtYXQoKTogWHJtLkF0dHJpYnV0ZXMuSW50ZWdlckF0dHJpYnV0ZUZvcm1hdCB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuQXR0cmlidXRlLmdldEZvcm1hdCgpIGFzIFhybS5BdHRyaWJ1dGVzLkludGVnZXJBdHRyaWJ1dGVGb3JtYXQ7XHJcbiAgICAgIH1cclxuICAgICAgZ2V0TWF4KCk6IG51bWJlciB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuQXR0cmlidXRlLmdldE1heCgpO1xyXG4gICAgICB9XHJcbiAgICAgIGdldE1pbigpOiBudW1iZXIge1xyXG4gICAgICAgIHJldHVybiB0aGlzLkF0dHJpYnV0ZS5nZXRNaW4oKTtcclxuICAgICAgfVxyXG4gICAgICBnZXRQcmVjaXNpb24oKTogbnVtYmVyIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5BdHRyaWJ1dGUuZ2V0UHJlY2lzaW9uKCk7XHJcbiAgICAgIH1cclxuICAgICAgc2V0UHJlY2lzaW9uKHByZWNpc2lvbjogbnVtYmVyKTogdm9pZCB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuQXR0cmlidXRlLnNldFByZWNpc2lvbihwcmVjaXNpb24pO1xyXG4gICAgICB9XHJcbiAgICAgIGdldCBBdHRyaWJ1dGUoKSB7XHJcbiAgICAgICAgcmV0dXJuICh0aGlzLl9hdHRyaWJ1dGUgPz89XHJcbiAgICAgICAgICBGb3JtLmZvcm1Db250ZXh0LmdldEF0dHJpYnV0ZSh0aGlzLk5hbWUpID8/XHJcbiAgICAgICAgICBYcm1FeC50aHJvd0Vycm9yKGBGaWVsZCAnJHt0aGlzLk5hbWV9JyBkb2VzIG5vdCBleGlzdGApKTtcclxuICAgICAgfVxyXG4gICAgICBnZXQgY29udHJvbHMoKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuQXR0cmlidXRlLmNvbnRyb2xzO1xyXG4gICAgICB9XHJcbiAgICAgIGdldCBWYWx1ZSgpOiBudW1iZXIge1xyXG4gICAgICAgIHJldHVybiB0aGlzLkF0dHJpYnV0ZS5nZXRWYWx1ZSgpID8/IG51bGw7XHJcbiAgICAgIH1cclxuICAgICAgc2V0IFZhbHVlKHZhbHVlOiBudW1iZXIpIHtcclxuICAgICAgICB0aGlzLkF0dHJpYnV0ZS5zZXRWYWx1ZSh2YWx1ZSk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICAgIGV4cG9ydCBjbGFzcyBEYXRlRmllbGRcclxuICAgICAgZXh0ZW5kcyBGaWVsZFxyXG4gICAgICBpbXBsZW1lbnRzIFhybS5BdHRyaWJ1dGVzLkRhdGVBdHRyaWJ1dGVcclxuICAgIHtcclxuICAgICAgcHJvdGVjdGVkIGRlY2xhcmUgX2F0dHJpYnV0ZTogWHJtLkF0dHJpYnV0ZXMuRGF0ZUF0dHJpYnV0ZTtcclxuICAgICAgY29uc3RydWN0b3IoYXR0cmlidXRlOiBzdHJpbmcpIHtcclxuICAgICAgICBzdXBlcihhdHRyaWJ1dGUpO1xyXG4gICAgICB9XHJcbiAgICAgIGdldEZvcm1hdCgpOiBYcm0uQXR0cmlidXRlcy5EYXRlQXR0cmlidXRlRm9ybWF0IHtcclxuICAgICAgICByZXR1cm4gdGhpcy5BdHRyaWJ1dGUuZ2V0Rm9ybWF0KCkgYXMgWHJtLkF0dHJpYnV0ZXMuRGF0ZUF0dHJpYnV0ZUZvcm1hdDtcclxuICAgICAgfVxyXG4gICAgICBnZXQgQXR0cmlidXRlKCkge1xyXG4gICAgICAgIHJldHVybiAodGhpcy5fYXR0cmlidXRlID8/PVxyXG4gICAgICAgICAgRm9ybS5mb3JtQ29udGV4dC5nZXRBdHRyaWJ1dGUodGhpcy5OYW1lKSA/P1xyXG4gICAgICAgICAgWHJtRXgudGhyb3dFcnJvcihgRmllbGQgJyR7dGhpcy5OYW1lfScgZG9lcyBub3QgZXhpc3RgKSk7XHJcbiAgICAgIH1cclxuICAgICAgZ2V0IGNvbnRyb2xzKCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLkF0dHJpYnV0ZS5jb250cm9scztcclxuICAgICAgfVxyXG4gICAgICBnZXQgVmFsdWUoKTogRGF0ZSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuQXR0cmlidXRlLmdldFZhbHVlKCkgPz8gbnVsbDtcclxuICAgICAgfVxyXG4gICAgICBzZXQgVmFsdWUodmFsdWU6IERhdGUpIHtcclxuICAgICAgICB0aGlzLkF0dHJpYnV0ZS5zZXRWYWx1ZSh2YWx1ZSk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICAgIGV4cG9ydCBjbGFzcyBCb29sZWFuRmllbGRcclxuICAgICAgZXh0ZW5kcyBGaWVsZFxyXG4gICAgICBpbXBsZW1lbnRzIFhybS5BdHRyaWJ1dGVzLkJvb2xlYW5BdHRyaWJ1dGVcclxuICAgIHtcclxuICAgICAgcHJvdGVjdGVkIGRlY2xhcmUgX2F0dHJpYnV0ZTogWHJtLkF0dHJpYnV0ZXMuQm9vbGVhbkF0dHJpYnV0ZTtcclxuICAgICAgY29uc3RydWN0b3IoYXR0cmlidXRlOiBzdHJpbmcpIHtcclxuICAgICAgICBzdXBlcihhdHRyaWJ1dGUpO1xyXG4gICAgICB9XHJcbiAgICAgIGdldEF0dHJpYnV0ZVR5cGUoKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuQXR0cmlidXRlLmdldEF0dHJpYnV0ZVR5cGUoKTtcclxuICAgICAgfVxyXG4gICAgICBnZXRJbml0aWFsVmFsdWUoKTogYm9vbGVhbiB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuQXR0cmlidXRlLmdldEluaXRpYWxWYWx1ZSgpO1xyXG4gICAgICB9XHJcbiAgICAgIGdldCBBdHRyaWJ1dGUoKSB7XHJcbiAgICAgICAgcmV0dXJuICh0aGlzLl9hdHRyaWJ1dGUgPz89XHJcbiAgICAgICAgICBGb3JtLmZvcm1Db250ZXh0LmdldEF0dHJpYnV0ZSh0aGlzLk5hbWUpID8/XHJcbiAgICAgICAgICBYcm1FeC50aHJvd0Vycm9yKGBGaWVsZCAnJHt0aGlzLk5hbWV9JyBkb2VzIG5vdCBleGlzdGApKTtcclxuICAgICAgfVxyXG4gICAgICBnZXQgY29udHJvbHMoKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuQXR0cmlidXRlLmNvbnRyb2xzO1xyXG4gICAgICB9XHJcbiAgICAgIGdldCBWYWx1ZSgpOiBib29sZWFuIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5BdHRyaWJ1dGUuZ2V0VmFsdWUoKSA/PyBudWxsO1xyXG4gICAgICB9XHJcbiAgICAgIHNldCBWYWx1ZSh2YWx1ZTogYm9vbGVhbikge1xyXG4gICAgICAgIHRoaXMuQXR0cmlidXRlLnNldFZhbHVlKHZhbHVlKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgZXhwb3J0IGNsYXNzIE11bHRpU2VsZWN0T3B0aW9uU2V0RmllbGQ8T3B0aW9ucyBleHRlbmRzIE9wdGlvblZhbHVlcz5cclxuICAgICAgZXh0ZW5kcyBGaWVsZFxyXG4gICAgICBpbXBsZW1lbnRzIFhybS5BdHRyaWJ1dGVzLk11bHRpU2VsZWN0T3B0aW9uU2V0QXR0cmlidXRlXHJcbiAgICB7XHJcbiAgICAgIHByb3RlY3RlZCBkZWNsYXJlIF9hdHRyaWJ1dGU6IFhybS5BdHRyaWJ1dGVzLk11bHRpU2VsZWN0T3B0aW9uU2V0QXR0cmlidXRlO1xyXG4gICAgICBPcHRpb246IE9wdGlvbnM7XHJcbiAgICAgIGNvbnN0cnVjdG9yKGF0dHJpYnV0ZU5hbWU6IHN0cmluZywgb3B0aW9uPzogT3B0aW9ucykge1xyXG4gICAgICAgIHN1cGVyKGF0dHJpYnV0ZU5hbWUpO1xyXG4gICAgICAgIHRoaXMuT3B0aW9uID0gb3B0aW9uO1xyXG4gICAgICB9XHJcbiAgICAgIGdldEZvcm1hdCgpOiBYcm0uQXR0cmlidXRlcy5PcHRpb25TZXRBdHRyaWJ1dGVGb3JtYXQge1xyXG4gICAgICAgIHJldHVybiB0aGlzLkF0dHJpYnV0ZS5nZXRGb3JtYXQoKSBhcyBYcm0uQXR0cmlidXRlcy5PcHRpb25TZXRBdHRyaWJ1dGVGb3JtYXQ7XHJcbiAgICAgIH1cclxuICAgICAgZ2V0T3B0aW9uKHZhbHVlOiBudW1iZXIgfCBzdHJpbmcpOiBYcm0uT3B0aW9uU2V0VmFsdWUge1xyXG4gICAgICAgIGlmICh0eXBlb2YgdmFsdWUgPT09IFwibnVtYmVyXCIpIHtcclxuICAgICAgICAgIHJldHVybiB0aGlzLkF0dHJpYnV0ZS5nZXRPcHRpb24odmFsdWUpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICByZXR1cm4gdGhpcy5BdHRyaWJ1dGUuZ2V0T3B0aW9uKHZhbHVlKTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgICAgZ2V0T3B0aW9ucygpOiBYcm0uT3B0aW9uU2V0VmFsdWVbXSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuQXR0cmlidXRlLmdldE9wdGlvbnMoKTtcclxuICAgICAgfVxyXG4gICAgICBnZXRTZWxlY3RlZE9wdGlvbigpOiBYcm0uT3B0aW9uU2V0VmFsdWVbXSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuQXR0cmlidXRlLmdldFNlbGVjdGVkT3B0aW9uKCk7XHJcbiAgICAgIH1cclxuICAgICAgZ2V0VGV4dCgpOiBzdHJpbmdbXSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuQXR0cmlidXRlLmdldFRleHQoKTtcclxuICAgICAgfVxyXG4gICAgICBnZXRJbml0aWFsVmFsdWUoKTogbnVtYmVyW10ge1xyXG4gICAgICAgIHJldHVybiB0aGlzLkF0dHJpYnV0ZS5nZXRJbml0aWFsVmFsdWUoKTtcclxuICAgICAgfVxyXG4gICAgICBnZXQgQXR0cmlidXRlKCkge1xyXG4gICAgICAgIHJldHVybiAodGhpcy5fYXR0cmlidXRlID8/PVxyXG4gICAgICAgICAgRm9ybS5mb3JtQ29udGV4dC5nZXRBdHRyaWJ1dGUodGhpcy5OYW1lKSA/P1xyXG4gICAgICAgICAgWHJtRXgudGhyb3dFcnJvcihgRmllbGQgJyR7dGhpcy5OYW1lfScgZG9lcyBub3QgZXhpc3RgKSk7XHJcbiAgICAgIH1cclxuICAgICAgZ2V0IGNvbnRyb2xzKCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLkF0dHJpYnV0ZS5jb250cm9scztcclxuICAgICAgfVxyXG4gICAgICBnZXQgVmFsdWUoKTogbnVtYmVyW10ge1xyXG4gICAgICAgIHJldHVybiB0aGlzLkF0dHJpYnV0ZS5nZXRWYWx1ZSgpO1xyXG4gICAgICB9XHJcbiAgICAgIHNldCBWYWx1ZSh2YWx1ZTogKGtleW9mIE9wdGlvbnMpW10gfCBudW1iZXJbXSkge1xyXG4gICAgICAgIGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSkge1xyXG4gICAgICAgICAgbGV0IHZhbHVlcyA9IFtdO1xyXG4gICAgICAgICAgdmFsdWUuZm9yRWFjaCgodikgPT4ge1xyXG4gICAgICAgICAgICBpZiAodHlwZW9mIHYgPT0gXCJudW1iZXJcIikgdmFsdWVzLnB1c2godik7XHJcbiAgICAgICAgICAgIGVsc2UgdmFsdWVzLnB1c2godGhpcy5PcHRpb25bdl0pO1xyXG4gICAgICAgICAgfSk7XHJcbiAgICAgICAgICB0aGlzLkF0dHJpYnV0ZS5zZXRWYWx1ZSh2YWx1ZXMpO1xyXG4gICAgICAgIH0gZWxzZSBYcm1FeC50aHJvd0Vycm9yKGBGaWVsZCBWYWx1ZSAnJHt2YWx1ZX0nIGlzIG5vdCBhbiBBcnJheWApO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgICBleHBvcnQgY2xhc3MgTG9va3VwRmllbGRcclxuICAgICAgZXh0ZW5kcyBGaWVsZFxyXG4gICAgICBpbXBsZW1lbnRzIFhybS5BdHRyaWJ1dGVzLkxvb2t1cEF0dHJpYnV0ZVxyXG4gICAge1xyXG4gICAgICBwcm90ZWN0ZWQgZGVjbGFyZSBfYXR0cmlidXRlOiBYcm0uQXR0cmlidXRlcy5Mb29rdXBBdHRyaWJ1dGU7XHJcbiAgICAgIHByb3RlY3RlZCBfY3VzdG9tRmlsdGVyczogYW55ID0gW107XHJcbiAgICAgIGNvbnN0cnVjdG9yKGF0dHJpYnV0ZTogc3RyaW5nKSB7XHJcbiAgICAgICAgc3VwZXIoYXR0cmlidXRlKTtcclxuICAgICAgfVxyXG4gICAgICBnZXRJc1BhcnR5TGlzdCgpOiBib29sZWFuIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5BdHRyaWJ1dGUuZ2V0SXNQYXJ0eUxpc3QoKTtcclxuICAgICAgfVxyXG4gICAgICBnZXQgQXR0cmlidXRlKCkge1xyXG4gICAgICAgIHJldHVybiAodGhpcy5fYXR0cmlidXRlID8/PVxyXG4gICAgICAgICAgRm9ybS5mb3JtQ29udGV4dC5nZXRBdHRyaWJ1dGUodGhpcy5OYW1lKSA/P1xyXG4gICAgICAgICAgWHJtRXgudGhyb3dFcnJvcihgRmllbGQgJyR7dGhpcy5OYW1lfScgZG9lcyBub3QgZXhpc3RgKSk7XHJcbiAgICAgIH1cclxuICAgICAgZ2V0IGNvbnRyb2xzKCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLkF0dHJpYnV0ZS5jb250cm9scztcclxuICAgICAgfVxyXG4gICAgICAvKipHZXRzIHRoZSBpZCBvZiB0aGUgZmlyc3QgbG9va3VwIHZhbHVlKi9cclxuICAgICAgZ2V0IElkKCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLlZhbHVlICYmIHRoaXMuVmFsdWUubGVuZ3RoID4gMFxyXG4gICAgICAgICAgPyBYcm1FeC5ub3JtYWxpemVHdWlkKHRoaXMuVmFsdWVbMF0uaWQpXHJcbiAgICAgICAgICA6IG51bGw7XHJcbiAgICAgIH1cclxuICAgICAgLyoqR2V0cyB0aGUgZW50aXR5VHlwZSBvZiB0aGUgZmlyc3QgbG9va3VwIHZhbHVlKi9cclxuICAgICAgZ2V0IEVudGl0eVR5cGUoKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuVmFsdWUgJiYgdGhpcy5WYWx1ZS5sZW5ndGggPiAwXHJcbiAgICAgICAgICA/IHRoaXMuVmFsdWVbMF0uZW50aXR5VHlwZVxyXG4gICAgICAgICAgOiBudWxsO1xyXG4gICAgICB9XHJcbiAgICAgIC8qKkdldHMgdGhlIGZvcm1hdHRlZCB2YWx1ZSBvZiB0aGUgZmlyc3QgbG9va3VwIHZhbHVlKi9cclxuICAgICAgZ2V0IEZvcm1hdHRlZFZhbHVlKCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLlZhbHVlICYmIHRoaXMuVmFsdWUubGVuZ3RoID4gMCA/IHRoaXMuVmFsdWVbMF0ubmFtZSA6IG51bGw7XHJcbiAgICAgIH1cclxuICAgICAgZ2V0IFZhbHVlKCk6IFhybS5Mb29rdXBWYWx1ZVtdIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5BdHRyaWJ1dGUuZ2V0VmFsdWUoKSA/PyBudWxsO1xyXG4gICAgICB9XHJcbiAgICAgIHNldCBWYWx1ZSh2YWx1ZTogWHJtLkxvb2t1cFZhbHVlW10pIHtcclxuICAgICAgICB0aGlzLkF0dHJpYnV0ZS5zZXRWYWx1ZSh2YWx1ZSk7XHJcbiAgICAgIH1cclxuICAgICAgLyoqXHJcbiAgICAgICAqIFNldHMgdGhlIHZhbHVlIG9mIGEgbG9va3VwXHJcbiAgICAgICAqIEBwYXJhbSBpZCBHdWlkIG9mIHRoZSByZWNvcmRcclxuICAgICAgICogQHBhcmFtIGVudGl0eVR5cGUgbG9naWNhbG5hbWUgb2YgdGhlIGVudGl0eVxyXG4gICAgICAgKiBAcGFyYW0gbmFtZSBmb3JtYXR0ZWQgdmFsdWVcclxuICAgICAgICogQHBhcmFtIGFwcGVuZCBpZiB0cnVlLCBhZGRzIHZhbHVlIHRvIHRoZSBhcnJheSBpbnN0ZWFkIG9mIHJlcGxhY2luZyBpdFxyXG4gICAgICAgKi9cclxuICAgICAgc2V0TG9va3VwVmFsdWUoXHJcbiAgICAgICAgaWQ6IHN0cmluZyxcclxuICAgICAgICBlbnRpdHlUeXBlOiBhbnksXHJcbiAgICAgICAgbmFtZTogYW55LFxyXG4gICAgICAgIGFwcGVuZCA9IGZhbHNlXHJcbiAgICAgICk6IHRoaXMge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICBpZiAoIWlkKSB0aHJvdyBuZXcgRXJyb3IoYG5vIGlkIHBhcmFtZXRlciB3YXMgcHJvdmlkZWQuYCk7XHJcbiAgICAgICAgICBpZiAoIWVudGl0eVR5cGUpXHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgbm8gZW50aXR5VHlwZSBwYXJhbWV0ZXIgd2FzIHByb3ZpZGVkLmApO1xyXG4gICAgICAgICAgaWQgPSBYcm1FeC5ub3JtYWxpemVHdWlkKGlkKTtcclxuICAgICAgICAgIGNvbnN0IGxvb2t1cFZhbHVlID0ge1xyXG4gICAgICAgICAgICBpZCxcclxuICAgICAgICAgICAgZW50aXR5VHlwZSxcclxuICAgICAgICAgICAgbmFtZSxcclxuICAgICAgICAgIH07XHJcbiAgICAgICAgICB0aGlzLlZhbHVlID1cclxuICAgICAgICAgICAgYXBwZW5kICYmIHRoaXMuVmFsdWVcclxuICAgICAgICAgICAgICA/IHRoaXMuVmFsdWUuY29uY2F0KGxvb2t1cFZhbHVlKVxyXG4gICAgICAgICAgICAgIDogW2xvb2t1cFZhbHVlXTtcclxuICAgICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcclxuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcclxuICAgICAgICAgICAgYFhybUV4LiR7WHJtRXguZ2V0RnVuY3Rpb25OYW1lKCl9OlxcbiR7ZXJyb3IubWVzc2FnZX1gXHJcbiAgICAgICAgICApO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgICAvKipcclxuICAgICAgICogU2V0cyBhIGxvb2t1cCB3aXRoIGEgbG9va3VwIGZyb20gdGhlIHJldHJpZXZlZCByZWNvcmQuXHJcbiAgICAgICAqIEBwYXJhbSBzZWxlY3ROYW1lXHJcbiAgICAgICAqIEBwYXJhbSByZXRyaWV2ZWRSZWNvcmRcclxuICAgICAgICogQGV4YW1wbGVcclxuICAgICAgICogdmFyIGNvbnRhY3QgPSBhd2FpdCBmaWVsZHMuQ29udGFjdC5yZXRyaWV2ZSgnPyRzZWxlY3Q9X3BhcmVudGN1c3RvbWVyaWRfdmFsdWUnKTtcclxuICAgICAgICogZmllbGRzLkFjY291bnQuc2V0TG9va3VwRnJvbVJldHJpZXZlKCdfcGFyZW50Y3VzdG9tZXJpZF92YWx1ZScsIGNvbnRhY3QpO1xyXG4gICAgICAgKiAvL0FsdGVybmF0ZVxyXG4gICAgICAgKiBmaWVsZHMuQWNjb3VudC5zZXRMb29rdXBGcm9tUmV0cmlldmUoJ3BhcmVudGN1c3RvbWVyaWQnLCBjb250YWN0KTtcclxuICAgICAgICovXHJcbiAgICAgIHNldExvb2t1cEZyb21SZXRyaWV2ZShcclxuICAgICAgICBzZWxlY3ROYW1lOiBzdHJpbmcsXHJcbiAgICAgICAgcmV0cmlldmVkUmVjb3JkOiB7IFt4OiBzdHJpbmddOiBhbnkgfVxyXG4gICAgICApIHtcclxuICAgICAgICBpZiAoIXNlbGVjdE5hbWUuZW5kc1dpdGgoXCJfdmFsdWVcIikpIHNlbGVjdE5hbWUgPSBgXyR7c2VsZWN0TmFtZX1fdmFsdWVgO1xyXG4gICAgICAgIGlmICghcmV0cmlldmVkUmVjb3JkIHx8ICFyZXRyaWV2ZWRSZWNvcmRbYCR7c2VsZWN0TmFtZX1gXSkge1xyXG4gICAgICAgICAgdGhpcy5WYWx1ZSA9IG51bGw7XHJcbiAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMuVmFsdWUgPSBbXHJcbiAgICAgICAgICB7XHJcbiAgICAgICAgICAgIGlkOiByZXRyaWV2ZWRSZWNvcmRbYCR7c2VsZWN0TmFtZX1gXSxcclxuICAgICAgICAgICAgZW50aXR5VHlwZTpcclxuICAgICAgICAgICAgICByZXRyaWV2ZWRSZWNvcmRbXHJcbiAgICAgICAgICAgICAgICBgJHtzZWxlY3ROYW1lfUBNaWNyb3NvZnQuRHluYW1pY3MuQ1JNLmxvb2t1cGxvZ2ljYWxuYW1lYFxyXG4gICAgICAgICAgICAgIF0sXHJcbiAgICAgICAgICAgIG5hbWU6IHJldHJpZXZlZFJlY29yZFtcclxuICAgICAgICAgICAgICBgJHtzZWxlY3ROYW1lfUBPRGF0YS5Db21tdW5pdHkuRGlzcGxheS5WMS5Gb3JtYXR0ZWRWYWx1ZWBcclxuICAgICAgICAgICAgXSxcclxuICAgICAgICAgIH0sXHJcbiAgICAgICAgXTtcclxuICAgICAgfVxyXG4gICAgICAvKipcclxuICAgICAgICogUmV0cmlldmVzIGFuIGVudGl0eSByZWNvcmQuXHJcbiAgICAgICAqIEBwYXJhbSBvcHRpb25zIChPcHRpb25hbCkgT0RhdGEgc3lzdGVtIHF1ZXJ5IG9wdGlvbnMsICRzZWxlY3QgYW5kICRleHBhbmQsIHRvIHJldHJpZXZlIHlvdXIgZGF0YS5cclxuICAgICAgICogLSBVc2UgdGhlICRzZWxlY3Qgc3lzdGVtIHF1ZXJ5IG9wdGlvbiB0byBsaW1pdCB0aGUgcHJvcGVydGllcyByZXR1cm5lZCBieSBpbmNsdWRpbmcgYSBjb21tYS1zZXBhcmF0ZWRcclxuICAgICAgICogICBsaXN0IG9mIHByb3BlcnR5IG5hbWVzLiBUaGlzIGlzIGFuIGltcG9ydGFudCBwZXJmb3JtYW5jZSBiZXN0IHByYWN0aWNlLiBJZiBwcm9wZXJ0aWVzIGFyZW7igJl0XHJcbiAgICAgICAqICAgc3BlY2lmaWVkIHVzaW5nICRzZWxlY3QsIGFsbCBwcm9wZXJ0aWVzIHdpbGwgYmUgcmV0dXJuZWQuXHJcbiAgICAgICAqIC0gVXNlIHRoZSAkZXhwYW5kIHN5c3RlbSBxdWVyeSBvcHRpb24gdG8gY29udHJvbCB3aGF0IGRhdGEgZnJvbSByZWxhdGVkIGVudGl0aWVzIGlzIHJldHVybmVkLiBJZiB5b3VcclxuICAgICAgICogICBqdXN0IGluY2x1ZGUgdGhlIG5hbWUgb2YgdGhlIG5hdmlnYXRpb24gcHJvcGVydHksIHlvdeKAmWxsIHJlY2VpdmUgYWxsIHRoZSBwcm9wZXJ0aWVzIGZvciByZWxhdGVkXHJcbiAgICAgICAqICAgcmVjb3Jkcy4gWW91IGNhbiBsaW1pdCB0aGUgcHJvcGVydGllcyByZXR1cm5lZCBmb3IgcmVsYXRlZCByZWNvcmRzIHVzaW5nIHRoZSAkc2VsZWN0IHN5c3RlbSBxdWVyeVxyXG4gICAgICAgKiAgIG9wdGlvbiBpbiBwYXJlbnRoZXNlcyBhZnRlciB0aGUgbmF2aWdhdGlvbiBwcm9wZXJ0eSBuYW1lLiBVc2UgdGhpcyBmb3IgYm90aCBzaW5nbGUtdmFsdWVkIGFuZFxyXG4gICAgICAgKiAgIGNvbGxlY3Rpb24tdmFsdWVkIG5hdmlnYXRpb24gcHJvcGVydGllcy5cclxuICAgICAgICogLSBZb3UgY2FuIGFsc28gc3BlY2lmeSBtdWx0aXBsZSBxdWVyeSBvcHRpb25zIGJ5IHVzaW5nICYgdG8gc2VwYXJhdGUgdGhlIHF1ZXJ5IG9wdGlvbnMuXHJcbiAgICAgICAqIEBleGFtcGxlIDxjYXB0aW9uPm9wdGlvbnMgZXhhbXBsZTo8L2NhcHRpb24+XHJcbiAgICAgICAqIG9wdGlvbnM6ICRzZWxlY3Q9bmFtZSYkZXhwYW5kPXByaW1hcnljb250YWN0aWQoJHNlbGVjdD1jb250YWN0aWQsZnVsbG5hbWUpXHJcbiAgICAgICAqIEByZXR1cm5zIE9uIHN1Y2Nlc3MsIHJldHVybnMgYSBwcm9taXNlIGNvbnRhaW5pbmcgYSBKU09OIG9iamVjdCB3aXRoIHRoZSByZXRyaWV2ZWQgYXR0cmlidXRlcyBhbmQgdGhlaXIgdmFsdWVzLlxyXG4gICAgICAgKiBAc2VlIHtAbGluayBodHRwczovL2RvY3MubWljcm9zb2Z0LmNvbS9lbi11cy9keW5hbWljczM2NS9jdXN0b21lci1lbmdhZ2VtZW50L2RldmVsb3Blci9jbGllbnRhcGkvcmVmZXJlbmNlL3hybS13ZWJhcGkvcmV0cmlldmVyZWNvcmQgRXh0ZXJuYWwgTGluazogcmV0cmlldmVSZWNvcmQgKENsaWVudCBBUEkgcmVmZXJlbmNlKX1cclxuICAgICAgICovXHJcbiAgICAgIGFzeW5jIHJldHJpZXZlKG9wdGlvbnM6IHN0cmluZykge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICBpZiAoIXRoaXMuSWQgfHwgIXRoaXMuRW50aXR5VHlwZSkgcmV0dXJuIG51bGw7XHJcbiAgICAgICAgICBjb25zdCByZWNvcmQgPSBhd2FpdCBYcm0uV2ViQXBpLnJldHJpZXZlUmVjb3JkKFxyXG4gICAgICAgICAgICB0aGlzLkVudGl0eVR5cGUsXHJcbiAgICAgICAgICAgIHRoaXMuSWQsXHJcbiAgICAgICAgICAgIG9wdGlvbnNcclxuICAgICAgICAgICk7XHJcbiAgICAgICAgICByZXR1cm4gcmVjb3JkO1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcclxuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcclxuICAgICAgICAgICAgYFhybUV4LiR7WHJtRXguZ2V0RnVuY3Rpb25OYW1lKCl9OlxcbiR7ZXJyb3IubWVzc2FnZX1gXHJcbiAgICAgICAgICApO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgICAvKipcclxuICAgICAgICogVXBkYXRlcyBhbiBlbnRpdHkgcmVjb3JkLlxyXG4gICAgICAgKiBAcGFyYW0gZGF0YSAocmVxdWlyZWQpIEEgSlNPTiBvYmplY3QgY29udGFpbmluZyBrZXkgOiB2YWx1ZSBwYWlycyB3aGVyZSBrZXkgaXMgdGhlIGF0dHJpYnV0ZSBvZiB0aGUgdGFibGVcclxuICAgICAgICogYW5kIHZhbHVlIGlzIHRoZSB2YWx1ZSBvZiB0aGUgYXR0cmlidXRlIHlvdSB3aXNoIHRvIHVwZGF0ZS5cclxuICAgICAgICogQGV4YW1wbGUgPGNhcHRpb24+ZGF0YSBleGFtcGxlOjwvY2FwdGlvbj5cclxuICAgICAgICogdmFyIGRhdGEgPVxyXG4gICAgICAgKiAgIHtcclxuICAgICAgICogICAgIFwibmFtZVwiOiBcIlVwZGF0ZWQgU2FtcGxlIEFjY291bnQgXCIsXHJcbiAgICAgICAqICAgICBcImNyZWRpdG9uaG9sZFwiOiB0cnVlLFxyXG4gICAgICAgKiAgICAgXCJhZGRyZXNzMV9sYXRpdHVkZVwiOiA0Ny42Mzk1ODMsXHJcbiAgICAgICAqICAgICBcImRlc2NyaXB0aW9uXCI6IFwiVGhpcyBpcyB0aGUgdXBkYXRlZCBkZXNjcmlwdGlvbiBvZiB0aGUgc2FtcGxlIGFjY291bnRcIixcclxuICAgICAgICogICAgIFwicmV2ZW51ZVwiOiA2MDAwMDAwLFxyXG4gICAgICAgKiAgICAgXCJhY2NvdW50Y2F0ZWdvcnljb2RlXCI6IDJcclxuICAgICAgICogICB9O1xyXG4gICAgICAgKiBAcmV0dXJucyBPbiBzdWNjZXNzLCByZXR1cm5zIGEgcHJvbWlzZSBvYmplY3Qgd2l0aCBlbnRpdHlUeXBlIChzdHJpbmcsIHRhYmxlIG5hbWUgb2YgcmVjb3JkKSBhbmQgaWQgKHN0cmluZywgR1VJRCBpZCBvZiB0aGUgcmVjb3JkKVxyXG4gICAgICAgKiBAc2VlIHtAbGluayBodHRwczovL2xlYXJuLm1pY3Jvc29mdC5jb20vZW4tdXMvcG93ZXItYXBwcy9kZXZlbG9wZXIvbW9kZWwtZHJpdmVuLWFwcHMvY2xpZW50YXBpL3JlZmVyZW5jZS94cm0td2ViYXBpL3VwZGF0ZXJlY29yZH1cclxuICAgICAgICovXHJcbiAgICAgIGFzeW5jIHVwZGF0ZShkYXRhOiBvYmplY3QpIHtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgaWYgKCF0aGlzLklkIHx8ICF0aGlzLkVudGl0eVR5cGUgfHwgIWRhdGEpIHJldHVybiBudWxsO1xyXG5cclxuICAgICAgICAgIGxldCByZWNvcmQgPSBudWxsO1xyXG5cclxuICAgICAgICAgIGlmIChpc09mZmxpbmUpIHtcclxuICAgICAgICAgICAgcmVjb3JkID0gYXdhaXQgWHJtLldlYkFwaS5vZmZsaW5lLnVwZGF0ZVJlY29yZChcclxuICAgICAgICAgICAgICB0aGlzLkVudGl0eVR5cGUsXHJcbiAgICAgICAgICAgICAgdGhpcy5JZCxcclxuICAgICAgICAgICAgICBkYXRhXHJcbiAgICAgICAgICAgICk7XHJcbiAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICByZWNvcmQgPSBhd2FpdCBYcm0uV2ViQXBpLnVwZGF0ZVJlY29yZChcclxuICAgICAgICAgICAgICB0aGlzLkVudGl0eVR5cGUsXHJcbiAgICAgICAgICAgICAgdGhpcy5JZCxcclxuICAgICAgICAgICAgICBkYXRhXHJcbiAgICAgICAgICAgICk7XHJcbiAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgcmV0dXJuIHJlY29yZDtcclxuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XHJcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXHJcbiAgICAgICAgICAgIGBYcm1FeC4ke1hybUV4LmdldEZ1bmN0aW9uTmFtZSgpfTpcXG4ke2Vycm9yLm1lc3NhZ2V9YFxyXG4gICAgICAgICAgKTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgICAgLyoqXHJcbiAgICAgICAqIEFkZHMgYW4gYWRkaXRpb25hbCBjdXN0b20gZmlsdGVyIHRvIHRoZSBsb29rdXAsIHdpdGggdGhlIFwiQU5EXCIgZmlsdGVyIG9wZXJhdG9yLlxyXG4gICAgICAgKiBAcGFyYW0gZmlsdGVyIFNwZWNpZmllcyB0aGUgZmlsdGVyLCBhcyBhIHNlcmlhbGl6ZWQgRmV0Y2hYTUwgXCJmaWx0ZXJcIiBub2RlLlxyXG4gICAgICAgKiBAcGFyYW0gZW50aXR5TG9naWNhbE5hbWUgKE9wdGlvbmFsKSBUaGUgbG9naWNhbCBuYW1lIG9mIHRoZSBlbnRpdHkuXHJcbiAgICAgICAqIEByZW1hcmtzICAgICBJZiBlbnRpdHlMb2dpY2FsTmFtZSBpcyBub3Qgc3BlY2lmaWVkLCB0aGUgZmlsdGVyIHdpbGwgYmUgYXBwbGllZCB0byBhbGwgZW50aXRpZXNcclxuICAgICAgICogICAgICAgICAgICAgIHZhbGlkIGZvciB0aGUgTG9va3VwIGNvbnRyb2wuXHJcbiAgICAgICAqIEBleGFtcGxlICAgICBFeGFtcGxlIGZpbHRlcjogPGZpbHRlciB0eXBlPVwiYW5kXCI+XHJcbiAgICAgICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPGNvbmRpdGlvbiBhdHRyaWJ1dGU9XCJhZGRyZXNzMV9jaXR5XCIgb3BlcmF0b3I9XCJlcVwiIHZhbHVlPVwiUmVkbW9uZFwiIC8+XHJcbiAgICAgICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9maWx0ZXI+XHJcbiAgICAgICAqL1xyXG4gICAgICBhZGRQcmVGaWx0ZXJUb0xvb2t1cChcclxuICAgICAgICBmaWx0ZXJYbWw6IHN0cmluZyxcclxuICAgICAgICBlbnRpdHlMb2dpY2FsTmFtZT86IHN0cmluZ1xyXG4gICAgICApOiB0aGlzIHtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgX2FkZEN1c3RvbUZpbHRlci5jb250cm9scyA9IHRoaXMuY29udHJvbHM7XHJcbiAgICAgICAgICB0aGlzLmNvbnRyb2xzLmZvckVhY2goKGNvbnRyb2wpID0+IHtcclxuICAgICAgICAgICAgY29udHJvbC5hZGRQcmVTZWFyY2goX2FkZEN1c3RvbUZpbHRlcik7XHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICAgIHRoaXMuX2N1c3RvbUZpbHRlcnMucHVzaChfYWRkQ3VzdG9tRmlsdGVyKTtcclxuICAgICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcclxuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcclxuICAgICAgICAgICAgYFhybUV4LiR7WHJtRXguZ2V0RnVuY3Rpb25OYW1lKCl9OlxcbiR7ZXJyb3IubWVzc2FnZX1gXHJcbiAgICAgICAgICApO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgZnVuY3Rpb24gX2FkZEN1c3RvbUZpbHRlcigpIHtcclxuICAgICAgICAgIF9hZGRDdXN0b21GaWx0ZXIuY29udHJvbHMuZm9yRWFjaCgoY29udHJvbCkgPT4ge1xyXG4gICAgICAgICAgICBjb250cm9sLmFkZEN1c3RvbUZpbHRlcihmaWx0ZXJYbWwsIGVudGl0eUxvZ2ljYWxOYW1lKTtcclxuICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgICAvKipcclxuICAgICAgICogQWRkcyBhbiBhZGRpdGlvbmFsIGN1c3RvbSBmaWx0ZXIgdG8gdGhlIGxvb2t1cCwgd2l0aCB0aGUgXCJBTkRcIiBmaWx0ZXIgb3BlcmF0b3IuXHJcbiAgICAgICAqIEBwYXJhbSBlbnRpdHlMb2dpY2FsTmFtZSAoT3B0aW9uYWwpIFRoZSBsb2dpY2FsIG5hbWUgb2YgdGhlIGVudGl0eS5cclxuICAgICAgICogQHBhcmFtIHByaW1hcnlBdHRyaWJ1dGVJZE5hbWUgKE9wdGlvbmFsKSBUaGUgbG9naWNhbCBuYW1lIG9mIHRoZSBwcmltYXJ5IGtleS5cclxuICAgICAgICogQHBhcmFtIGZldGNoWG1sIFNwZWNpZmllcyB0aGUgRmV0Y2hYTUwgdXNlZCB0byBmaWx0ZXIuXHJcbiAgICAgICAqIEByZW1hcmtzICAgICBJZiBlbnRpdHlMb2dpY2FsTmFtZSBpcyBub3Qgc3BlY2lmaWVkLCB0aGUgZmlsdGVyIHdpbGwgYmUgYXBwbGllZCB0byBhbGwgZW50aXRpZXNcclxuICAgICAgICogICAgICAgICAgICAgIHZhbGlkIGZvciB0aGUgTG9va3VwIGNvbnRyb2wuXHJcbiAgICAgICAqIEBleGFtcGxlICAgICBFeGFtcGxlIGZldGNoWG1sOiA8ZmV0Y2g+XHJcbiAgICAgICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPGVudGl0eSBuYW1lPVwiY29udGFjdFwiPlxyXG4gICAgICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8ZmlsdGVyPlxyXG4gICAgICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8Y29uZGl0aW9uIGF0dHJpYnV0ZT1cImFkZHJlc3MxX2NpdHlcIiBvcGVyYXRvcj1cImVxXCIgdmFsdWU9XCJSZWRtb25kXCIgLz5cclxuICAgICAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9maWx0ZXI+XHJcbiAgICAgICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9lbnRpdHk+XHJcbiAgICAgICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9mZXRjaD5cclxuICAgICAgICovXHJcbiAgICAgIGFzeW5jIGFkZFByZUZpbHRlclRvTG9va3VwQWR2YW5jZWQoXHJcbiAgICAgICAgZW50aXR5TG9naWNhbE5hbWU6IHN0cmluZyxcclxuICAgICAgICBwcmltYXJ5QXR0cmlidXRlSWROYW1lOiBzdHJpbmcsXHJcbiAgICAgICAgZmV0Y2hYbWw6IHN0cmluZ1xyXG4gICAgICApOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgWHJtLldlYkFwaS5vbmxpbmUucmV0cmlldmVNdWx0aXBsZVJlY29yZHMoXHJcbiAgICAgICAgICAgIGVudGl0eUxvZ2ljYWxOYW1lLFxyXG4gICAgICAgICAgICBcIj9mZXRjaFhtbD1cIiArIGZldGNoWG1sXHJcbiAgICAgICAgICApO1xyXG4gICAgICAgICAgY29uc3QgZGF0YSA9IHJlc3VsdC5lbnRpdGllcztcclxuICAgICAgICAgIGxldCBmaWx0ZXJlZEVudGl0aWVzID0gXCJcIjtcclxuICAgICAgICAgIF9hZGRDdXN0b21GaWx0ZXIuY29udHJvbHMgPSB0aGlzLmNvbnRyb2xzO1xyXG4gICAgICAgICAgZGF0YS5mb3JFYWNoKChpdGVtKSA9PiB7XHJcbiAgICAgICAgICAgIGZpbHRlcmVkRW50aXRpZXMgKz0gYDx2YWx1ZT4ke2l0ZW1bcHJpbWFyeUF0dHJpYnV0ZUlkTmFtZV19PC92YWx1ZT5gO1xyXG4gICAgICAgICAgfSk7XHJcbiAgICAgICAgICBmZXRjaFhtbCA9IGZpbHRlcmVkRW50aXRpZXNcclxuICAgICAgICAgICAgPyBgPGZpbHRlcj48Y29uZGl0aW9uIGF0dHJpYnV0ZT0nJHtwcmltYXJ5QXR0cmlidXRlSWROYW1lfScgb3BlcmF0b3I9J2luJz4ke2ZpbHRlcmVkRW50aXRpZXN9PC9jb25kaXRpb24+PC9maWx0ZXI+YFxyXG4gICAgICAgICAgICA6IGA8ZmlsdGVyPjxjb25kaXRpb24gYXR0cmlidXRlPScke3ByaW1hcnlBdHRyaWJ1dGVJZE5hbWV9JyBvcGVyYXRvcj0nbnVsbCcvPjwvZmlsdGVyPmA7XHJcbiAgICAgICAgICB0aGlzLmNvbnRyb2xzLmZvckVhY2goKGNvbnRyb2wpID0+IHtcclxuICAgICAgICAgICAgY29udHJvbC5hZGRQcmVTZWFyY2goX2FkZEN1c3RvbUZpbHRlcik7XHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICAgIHRoaXMuX2N1c3RvbUZpbHRlcnMucHVzaChfYWRkQ3VzdG9tRmlsdGVyKTtcclxuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XHJcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXHJcbiAgICAgICAgICAgIGBYcm1FeC4ke1hybUV4LmdldEZ1bmN0aW9uTmFtZSgpfTpcXG4ke2Vycm9yLm1lc3NhZ2V9YFxyXG4gICAgICAgICAgKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZnVuY3Rpb24gX2FkZEN1c3RvbUZpbHRlcigpIHtcclxuICAgICAgICAgIF9hZGRDdXN0b21GaWx0ZXIuY29udHJvbHMuZm9yRWFjaCgoY29udHJvbCkgPT4ge1xyXG4gICAgICAgICAgICBjb250cm9sLmFkZEN1c3RvbUZpbHRlcihmZXRjaFhtbCwgZW50aXR5TG9naWNhbE5hbWUpO1xyXG4gICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICAgIC8qKlxyXG4gICAgICAgKiBSZW1vdmVzIGFsbCBmaWx0ZXJzIHNldCBvbiB0aGUgY3VycmVudCBsb29rdXAgYXR0cmlidXRlIGJ5IHVzaW5nIGFkZFByZUZpbHRlclRvTG9va3VwIG9yIGFkZFByZUZpbHRlclRvTG9va3VwQWR2YW5jZWRcclxuICAgICAgICovXHJcbiAgICAgIGNsZWFyUHJlRmlsdGVyRnJvbUxvb2t1cCgpOiB0aGlzIHtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgdGhpcy5fY3VzdG9tRmlsdGVycy5mb3JFYWNoKFxyXG4gICAgICAgICAgICAoY3VzdG9tRmlsdGVyOiBYcm0uRXZlbnRzLkNvbnRleHRTZW5zaXRpdmVIYW5kbGVyKSA9PiB7XHJcbiAgICAgICAgICAgICAgdGhpcy5jb250cm9scy5mb3JFYWNoKChjb250cm9sKSA9PiB7XHJcbiAgICAgICAgICAgICAgICBjb250cm9sLnJlbW92ZVByZVNlYXJjaChjdXN0b21GaWx0ZXIpO1xyXG4gICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICApO1xyXG4gICAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xyXG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxyXG4gICAgICAgICAgICBgWHJtRXguJHtYcm1FeC5nZXRGdW5jdGlvbk5hbWUoKX06XFxuJHtlcnJvci5tZXNzYWdlfWBcclxuICAgICAgICAgICk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgICB0eXBlIE9wdGlvblZhbHVlcyA9IHtcclxuICAgICAgW2tleTogc3RyaW5nXTogbnVtYmVyO1xyXG4gICAgfTtcclxuICAgIGV4cG9ydCBjbGFzcyBPcHRpb25zZXRGaWVsZDxPcHRpb25zIGV4dGVuZHMgT3B0aW9uVmFsdWVzPlxyXG4gICAgICBleHRlbmRzIEZpZWxkXHJcbiAgICAgIGltcGxlbWVudHMgWHJtLkF0dHJpYnV0ZXMuT3B0aW9uU2V0QXR0cmlidXRlXHJcbiAgICB7XHJcbiAgICAgIHByb3RlY3RlZCBkZWNsYXJlIF9hdHRyaWJ1dGU6IFhybS5BdHRyaWJ1dGVzLk9wdGlvblNldEF0dHJpYnV0ZTtcclxuICAgICAgcHJvdGVjdGVkIF9jb250cm9sITogWHJtLkNvbnRyb2xzLk9wdGlvblNldENvbnRyb2w7XHJcbiAgICAgIE9wdGlvbjogT3B0aW9ucztcclxuICAgICAgY29uc3RydWN0b3IoYXR0cmlidXRlTmFtZTogc3RyaW5nLCBvcHRpb24/OiBPcHRpb25zKSB7XHJcbiAgICAgICAgc3VwZXIoYXR0cmlidXRlTmFtZSk7XHJcbiAgICAgICAgdGhpcy5PcHRpb24gPSBvcHRpb247XHJcbiAgICAgIH1cclxuICAgICAgZ2V0Rm9ybWF0KCk6IFhybS5BdHRyaWJ1dGVzLk9wdGlvblNldEF0dHJpYnV0ZUZvcm1hdCB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuQXR0cmlidXRlLmdldEZvcm1hdCgpIGFzIFhybS5BdHRyaWJ1dGVzLk9wdGlvblNldEF0dHJpYnV0ZUZvcm1hdDtcclxuICAgICAgfVxyXG4gICAgICBnZXRPcHRpb24odmFsdWU6IG51bWJlciB8IHN0cmluZyk6IFhybS5PcHRpb25TZXRWYWx1ZSB7XHJcbiAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gXCJudW1iZXJcIikge1xyXG4gICAgICAgICAgcmV0dXJuIHRoaXMuQXR0cmlidXRlLmdldE9wdGlvbih2YWx1ZSk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgIHJldHVybiB0aGlzLkF0dHJpYnV0ZS5nZXRPcHRpb24odmFsdWUpO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgICBnZXRPcHRpb25zKCk6IFhybS5PcHRpb25TZXRWYWx1ZVtdIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5BdHRyaWJ1dGUuZ2V0T3B0aW9ucygpO1xyXG4gICAgICB9XHJcbiAgICAgIGdldFNlbGVjdGVkT3B0aW9uKCk6IFhybS5PcHRpb25TZXRWYWx1ZSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuQXR0cmlidXRlLmdldFNlbGVjdGVkT3B0aW9uKCk7XHJcbiAgICAgIH1cclxuICAgICAgZ2V0VGV4dCgpOiBzdHJpbmcge1xyXG4gICAgICAgIHJldHVybiB0aGlzLkF0dHJpYnV0ZS5nZXRUZXh0KCk7XHJcbiAgICAgIH1cclxuICAgICAgZ2V0SW5pdGlhbFZhbHVlKCk6IG51bWJlciB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuQXR0cmlidXRlLmdldEluaXRpYWxWYWx1ZSgpO1xyXG4gICAgICB9XHJcbiAgICAgIGdldCBBdHRyaWJ1dGUoKSB7XHJcbiAgICAgICAgcmV0dXJuICh0aGlzLl9hdHRyaWJ1dGUgPz89XHJcbiAgICAgICAgICBGb3JtLmZvcm1Db250ZXh0LmdldEF0dHJpYnV0ZSh0aGlzLk5hbWUpID8/XHJcbiAgICAgICAgICBYcm1FeC50aHJvd0Vycm9yKGBGaWVsZCAnJHt0aGlzLk5hbWV9JyBkb2VzIG5vdCBleGlzdGApKTtcclxuICAgICAgfVxyXG4gICAgICBnZXQgY29udHJvbHMoKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuQXR0cmlidXRlLmNvbnRyb2xzO1xyXG4gICAgICB9XHJcbiAgICAgIGdldCBjb250cm9sKCkge1xyXG4gICAgICAgIHJldHVybiAodGhpcy5fY29udHJvbCA/Pz1cclxuICAgICAgICAgIEZvcm0uZm9ybUNvbnRleHQuZ2V0Q29udHJvbCh0aGlzLk5hbWUpID8/XHJcbiAgICAgICAgICBYcm1FeC50aHJvd0Vycm9yKGBDb250cm9sICcke3RoaXMuTmFtZX0nIGRvZXMgbm90IGV4aXN0YCkpO1xyXG4gICAgICB9XHJcbiAgICAgIGdldCBWYWx1ZSgpOiBudW1iZXIge1xyXG4gICAgICAgIHJldHVybiB0aGlzLkF0dHJpYnV0ZS5nZXRWYWx1ZSgpO1xyXG4gICAgICB9XHJcbiAgICAgIHNldCBWYWx1ZSh2YWx1ZToga2V5b2YgT3B0aW9ucyB8IG51bWJlcikge1xyXG4gICAgICAgIGlmICh0eXBlb2YgdmFsdWUgPT0gXCJudW1iZXJcIikgdGhpcy5BdHRyaWJ1dGUuc2V0VmFsdWUodmFsdWUpO1xyXG4gICAgICAgIGVsc2UgdGhpcy5BdHRyaWJ1dGUuc2V0VmFsdWUodGhpcy5PcHRpb25bdmFsdWVdKTtcclxuICAgICAgfVxyXG4gICAgICAvKipcclxuICAgICAgICogQWRkcyBhbiBvcHRpb24uXHJcbiAgICAgICAqXHJcbiAgICAgICAqIEBwYXJhbSB2YWx1ZXMgYW4gYXJyYXkgd2l0aCB0aGUgb3B0aW9uIHZhbHVlcyB0byBhZGRcclxuICAgICAgICogQHBhcmFtIGluZGV4IChPcHRpb25hbCkgemVyby1iYXNlZCBpbmRleCBvZiB0aGUgb3B0aW9uLlxyXG4gICAgICAgKlxyXG4gICAgICAgKiBAcmVtYXJrcyBUaGlzIG1ldGhvZCBkb2VzIG5vdCBjaGVjayB0aGF0IHRoZSB2YWx1ZXMgd2l0aGluIHRoZSBvcHRpb25zIHlvdSBhZGQgYXJlIHZhbGlkLlxyXG4gICAgICAgKiAgICAgICAgICBJZiBpbmRleCBpcyBub3QgcHJvdmlkZWQsIHRoZSBuZXcgb3B0aW9uIHdpbGwgYmUgYWRkZWQgdG8gdGhlIGVuZCBvZiB0aGUgbGlzdC5cclxuICAgICAgICovXHJcbiAgICAgIGFkZE9wdGlvbih2YWx1ZXM6IG51bWJlcltdLCBpbmRleD86IG51bWJlcik6IHRoaXMge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICBpZiAoIUFycmF5LmlzQXJyYXkodmFsdWVzKSlcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGB2YWx1ZXMgaXMgbm90IGFuIEFycmF5OlxcbnZhbHVlczogJyR7dmFsdWVzfSdgKTtcclxuICAgICAgICAgIGNvbnN0IG9wdGlvblNldFZhbHVlcyA9XHJcbiAgICAgICAgICAgIHRoaXMuY29udHJvbC5nZXRBdHRyaWJ1dGUoKS5nZXRPcHRpb25zKCkgPz8gW107XHJcbiAgICAgICAgICBmb3IgKGNvbnN0IGVsZW1lbnQgb2Ygb3B0aW9uU2V0VmFsdWVzKSB7XHJcbiAgICAgICAgICAgIGlmICh2YWx1ZXMuaW5jbHVkZXMoZWxlbWVudC52YWx1ZSkpIHtcclxuICAgICAgICAgICAgICB0aGlzLmNvbnRyb2wuYWRkT3B0aW9uKGVsZW1lbnQsIGluZGV4KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xyXG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxyXG4gICAgICAgICAgICBgWHJtRXguJHtYcm1FeC5nZXRGdW5jdGlvbk5hbWUoKX06XFxuJHtlcnJvci5tZXNzYWdlfWBcclxuICAgICAgICAgICk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICAgIC8qKlxyXG4gICAgICAgKiBSZW1vdmVzIHRoZSBvcHRpb24gbWF0Y2hpbmcgdGhlIHZhbHVlLlxyXG4gICAgICAgKlxyXG4gICAgICAgKiBAcGFyYW0gdmFsdWUgVGhlIHZhbHVlLlxyXG4gICAgICAgKi9cclxuICAgICAgcmVtb3ZlT3B0aW9uKHZhbHVlczogbnVtYmVyW10pOiB0aGlzIHtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgaWYgKCFBcnJheS5pc0FycmF5KHZhbHVlcykpXHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgdmFsdWVzIGlzIG5vdCBhbiBBcnJheTpcXG52YWx1ZXM6ICcke3ZhbHVlc30nYCk7XHJcbiAgICAgICAgICBjb25zdCBvcHRpb25TZXRWYWx1ZXMgPVxyXG4gICAgICAgICAgICB0aGlzLmNvbnRyb2wuZ2V0QXR0cmlidXRlKCkuZ2V0T3B0aW9ucygpID8/IFtdO1xyXG4gICAgICAgICAgZm9yIChjb25zdCBlbGVtZW50IG9mIG9wdGlvblNldFZhbHVlcykge1xyXG4gICAgICAgICAgICBpZiAodmFsdWVzLmluY2x1ZGVzKGVsZW1lbnQudmFsdWUpKSB7XHJcbiAgICAgICAgICAgICAgdGhpcy5jb250cm9sLnJlbW92ZU9wdGlvbihlbGVtZW50LnZhbHVlKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xyXG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxyXG4gICAgICAgICAgICBgWHJtRXguJHtYcm1FeC5nZXRGdW5jdGlvbk5hbWUoKX06XFxuJHtlcnJvci5tZXNzYWdlfWBcclxuICAgICAgICAgICk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICAgIC8qKlxyXG4gICAgICAgKiBDbGVhcnMgYWxsIG9wdGlvbnMuXHJcbiAgICAgICAqL1xyXG4gICAgICBjbGVhck9wdGlvbnMoKTogdGhpcyB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgIHRoaXMuY29udHJvbC5jbGVhck9wdGlvbnMoKTtcclxuICAgICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcclxuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcclxuICAgICAgICAgICAgYFhybUV4LiR7WHJtRXguZ2V0RnVuY3Rpb25OYW1lKCl9OlxcbiR7ZXJyb3IubWVzc2FnZX1gXHJcbiAgICAgICAgICApO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgZXhwb3J0IGNsYXNzIFNlY3Rpb24gaW1wbGVtZW50cyBYcm0uQ29udHJvbHMuU2VjdGlvbiB7XHJcbiAgICAgIHB1YmxpYyByZWFkb25seSBOYW1lITogc3RyaW5nO1xyXG4gICAgICBwcm90ZWN0ZWQgX3NlY3Rpb24/OiBYcm0uQ29udHJvbHMuU2VjdGlvbjtcclxuICAgICAgcHVibGljIHBhcmVudFRhYj86IFhybS5Db250cm9scy5UYWI7XHJcbiAgICAgIGNvbnN0cnVjdG9yKG5hbWU6IHN0cmluZykge1xyXG4gICAgICAgIHRoaXMuTmFtZSA9IG5hbWU7XHJcbiAgICAgIH1cclxuICAgICAgcHVibGljIGdldCBTZWN0aW9uKCk6IFhybS5Db250cm9scy5TZWN0aW9uIHtcclxuICAgICAgICByZXR1cm4gKHRoaXMuX3NlY3Rpb24gPz89XHJcbiAgICAgICAgICB0aGlzLnBhcmVudFRhYi5zZWN0aW9ucy5nZXQodGhpcy5OYW1lKSA/P1xyXG4gICAgICAgICAgWHJtRXgudGhyb3dFcnJvcihcclxuICAgICAgICAgICAgYFRoZSBzZWN0aW9uICcke3RoaXMuTmFtZX0nIHdhcyBub3QgZm91bmQgb24gdGhlIGZvcm0uYFxyXG4gICAgICAgICAgKSk7XHJcbiAgICAgIH1cclxuICAgICAgZ2V0TmFtZSgpOiBzdHJpbmcge1xyXG4gICAgICAgIHJldHVybiB0aGlzLlNlY3Rpb24uZ2V0TmFtZSgpO1xyXG4gICAgICB9XHJcbiAgICAgIGdldFBhcmVudCgpOiBYcm0uQ29udHJvbHMuVGFiIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5TZWN0aW9uLmdldFBhcmVudCgpO1xyXG4gICAgICB9XHJcbiAgICAgIGNvbnRyb2xzOiBYcm0uQ29sbGVjdGlvbi5JdGVtQ29sbGVjdGlvbjxYcm0uQ29udHJvbHMuQ29udHJvbD47XHJcbiAgICAgIHNldFZpc2libGUodmlzaWJsZTogYm9vbGVhbik6IHZvaWQge1xyXG4gICAgICAgIHJldHVybiB0aGlzLlNlY3Rpb24uc2V0VmlzaWJsZSh2aXNpYmxlKTtcclxuICAgICAgfVxyXG4gICAgICBnZXRWaXNpYmxlKCk6IGJvb2xlYW4ge1xyXG4gICAgICAgIHJldHVybiB0aGlzLlNlY3Rpb24uZ2V0VmlzaWJsZSgpO1xyXG4gICAgICB9XHJcbiAgICAgIGdldExhYmVsKCk6IHN0cmluZyB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuU2VjdGlvbi5nZXRMYWJlbCgpO1xyXG4gICAgICB9XHJcbiAgICAgIHNldExhYmVsKGxhYmVsOiBzdHJpbmcpOiB2b2lkIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5TZWN0aW9uLnNldExhYmVsKGxhYmVsKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgdHlwZSBUYWJTZWN0aW9ucyA9IHtcclxuICAgICAgW2tleTogc3RyaW5nXTogU2VjdGlvbjtcclxuICAgIH07XHJcbiAgICBleHBvcnQgY2xhc3MgVGFiPFNlY3Rpb25zIGV4dGVuZHMgVGFiU2VjdGlvbnM+IGltcGxlbWVudHMgWHJtLkNvbnRyb2xzLlRhYiB7XHJcbiAgICAgIHB1YmxpYyByZWFkb25seSBOYW1lITogc3RyaW5nO1xyXG4gICAgICBwcm90ZWN0ZWQgX3RhYj86IFhybS5Db250cm9scy5UYWI7XHJcbiAgICAgIFNlY3Rpb246IFNlY3Rpb25zO1xyXG4gICAgICBjb25zdHJ1Y3RvcihuYW1lOiBzdHJpbmcsIHNlY3Rpb24/OiBTZWN0aW9ucykge1xyXG4gICAgICAgIHRoaXMuTmFtZSA9IG5hbWU7XHJcbiAgICAgICAgdGhpcy5TZWN0aW9uID0gc2VjdGlvbjtcclxuICAgICAgICBmb3IgKGxldCBrZXkgaW4gc2VjdGlvbikge1xyXG4gICAgICAgICAgc2VjdGlvbltrZXldLnBhcmVudFRhYiA9IHRoaXM7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICAgIGdldCBzZWN0aW9ucygpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5UYWIuc2VjdGlvbnM7XHJcbiAgICAgIH1cclxuICAgICAgcHVibGljIGdldCBUYWIoKTogWHJtLkNvbnRyb2xzLlRhYiB7XHJcbiAgICAgICAgcmV0dXJuICh0aGlzLl90YWIgPz89XHJcbiAgICAgICAgICBGb3JtLmZvcm1Db250ZXh0LnVpLnRhYnMuZ2V0KHRoaXMuTmFtZSkgPz9cclxuICAgICAgICAgIFhybUV4LnRocm93RXJyb3IoXHJcbiAgICAgICAgICAgIGBUaGUgdGFiICcke3RoaXMuTmFtZX0nIHdhcyBub3QgZm91bmQgb24gdGhlIGZvcm0uYFxyXG4gICAgICAgICAgKSk7XHJcbiAgICAgIH1cclxuICAgICAgYWRkVGFiU3RhdGVDaGFuZ2UoaGFuZGxlcjogWHJtLkV2ZW50cy5Db250ZXh0U2Vuc2l0aXZlSGFuZGxlcik6IHZvaWQge1xyXG4gICAgICAgIHJldHVybiB0aGlzLlRhYi5hZGRUYWJTdGF0ZUNoYW5nZShoYW5kbGVyKTtcclxuICAgICAgfVxyXG4gICAgICBnZXREaXNwbGF5U3RhdGUoKTogWHJtLkRpc3BsYXlTdGF0ZSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuVGFiLmdldERpc3BsYXlTdGF0ZSgpO1xyXG4gICAgICB9XHJcbiAgICAgIGdldE5hbWUoKTogc3RyaW5nIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5UYWIuZ2V0TmFtZSgpO1xyXG4gICAgICB9XHJcbiAgICAgIGdldFBhcmVudCgpOiBYcm0uVWkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLlRhYi5nZXRQYXJlbnQoKTtcclxuICAgICAgfVxyXG4gICAgICByZW1vdmVUYWJTdGF0ZUNoYW5nZShoYW5kbGVyOiBYcm0uRXZlbnRzLkNvbnRleHRTZW5zaXRpdmVIYW5kbGVyKTogdm9pZCB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuVGFiLnJlbW92ZVRhYlN0YXRlQ2hhbmdlKGhhbmRsZXIpO1xyXG4gICAgICB9XHJcbiAgICAgIHNldERpc3BsYXlTdGF0ZShkaXNwbGF5U3RhdGU6IFhybS5EaXNwbGF5U3RhdGUpOiB2b2lkIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5UYWIuc2V0RGlzcGxheVN0YXRlKGRpc3BsYXlTdGF0ZSk7XHJcbiAgICAgIH1cclxuICAgICAgc2V0VmlzaWJsZSh2aXNpYmxlOiBib29sZWFuKTogdm9pZCB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuVGFiLnNldFZpc2libGUodmlzaWJsZSk7XHJcbiAgICAgIH1cclxuICAgICAgZ2V0VmlzaWJsZSgpOiBib29sZWFuIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5UYWIuZ2V0VmlzaWJsZSgpO1xyXG4gICAgICB9XHJcbiAgICAgIGdldExhYmVsKCk6IHN0cmluZyB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuVGFiLmdldExhYmVsKCk7XHJcbiAgICAgIH1cclxuICAgICAgc2V0TGFiZWwobGFiZWw6IHN0cmluZyk6IHZvaWQge1xyXG4gICAgICAgIHJldHVybiB0aGlzLlRhYi5zZXRMYWJlbChsYWJlbCk7XHJcbiAgICAgIH1cclxuICAgICAgc2V0Rm9jdXMoKTogdm9pZCB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuVGFiLnNldEZvY3VzKCk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICAgIGV4cG9ydCBjbGFzcyBHcmlkQ29udHJvbCBpbXBsZW1lbnRzIFhybS5Db250cm9scy5HcmlkQ29udHJvbCB7XHJcbiAgICAgIHB1YmxpYyByZWFkb25seSBOYW1lITogc3RyaW5nO1xyXG4gICAgICBwcm90ZWN0ZWQgX2dyaWRDb250cm9sPzogWHJtLkNvbnRyb2xzLkdyaWRDb250cm9sO1xyXG4gICAgICBjb25zdHJ1Y3RvcihuYW1lOiBzdHJpbmcpIHtcclxuICAgICAgICB0aGlzLk5hbWUgPSBuYW1lO1xyXG4gICAgICB9XHJcbiAgICAgIHB1YmxpYyBnZXQgR3JpZENvbnRyb2woKTogWHJtLkNvbnRyb2xzLkdyaWRDb250cm9sIHtcclxuICAgICAgICByZXR1cm4gKFxyXG4gICAgICAgICAgKHRoaXMuX2dyaWRDb250cm9sID8/PVxyXG4gICAgICAgICAgICBGb3JtLmZvcm1Db250ZXh0LmdldENvbnRyb2w8WHJtLkNvbnRyb2xzLkdyaWRDb250cm9sPih0aGlzLk5hbWUpKSA/P1xyXG4gICAgICAgICAgWHJtRXgudGhyb3dFcnJvcihgVGhlIGdyaWQgJyR7dGhpcy5OYW1lfScgd2FzIG5vdCBmb3VuZCBvbiB0aGUgZm9ybS5gKVxyXG4gICAgICAgICk7XHJcbiAgICAgIH1cclxuICAgICAgcHVibGljIGdldCBHcmlkKCk6IFhybS5Db250cm9scy5HcmlkIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5HcmlkQ29udHJvbC5nZXRHcmlkKCk7XHJcbiAgICAgIH1cclxuICAgICAgYWRkT25Mb2FkKGhhbmRsZXI6IFhybS5FdmVudHMuR3JpZENvbnRyb2wuTG9hZEV2ZW50SGFuZGxlcik6IHZvaWQge1xyXG4gICAgICAgIHRoaXMuR3JpZENvbnRyb2wucmVtb3ZlT25Mb2FkKGhhbmRsZXIgYXMgYW55KTtcclxuICAgICAgICByZXR1cm4gdGhpcy5HcmlkQ29udHJvbC5hZGRPbkxvYWQoaGFuZGxlcik7XHJcbiAgICAgIH1cclxuICAgICAgZ2V0Q29udGV4dFR5cGUoKTogWHJtRW51bS5HcmlkQ29udHJvbENvbnRleHQge1xyXG4gICAgICAgIHJldHVybiB0aGlzLkdyaWRDb250cm9sLmdldENvbnRleHRUeXBlKCk7XHJcbiAgICAgIH1cclxuICAgICAgZ2V0RW50aXR5TmFtZSgpOiBzdHJpbmcge1xyXG4gICAgICAgIHJldHVybiB0aGlzLkdyaWRDb250cm9sLmdldEVudGl0eU5hbWUoKTtcclxuICAgICAgfVxyXG4gICAgICBnZXRGZXRjaFhtbCgpOiBzdHJpbmcge1xyXG4gICAgICAgIHJldHVybiB0aGlzLkdyaWRDb250cm9sLmdldEZldGNoWG1sKCk7XHJcbiAgICAgIH1cclxuICAgICAgZ2V0R3JpZCgpOiBYcm0uQ29udHJvbHMuR3JpZCB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuR3JpZENvbnRyb2wuZ2V0R3JpZCgpO1xyXG4gICAgICB9XHJcbiAgICAgIGdldFJlbGF0aW9uc2hpcCgpOiBYcm0uQ29udHJvbHMuR3JpZFJlbGF0aW9uc2hpcCB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuR3JpZENvbnRyb2wuZ2V0UmVsYXRpb25zaGlwKCk7XHJcbiAgICAgIH1cclxuICAgICAgZ2V0VXJsKGNsaWVudD86IFhybUVudW0uR3JpZENsaWVudCk6IHN0cmluZyB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuR3JpZENvbnRyb2wuZ2V0VXJsKGNsaWVudCk7XHJcbiAgICAgIH1cclxuICAgICAgZ2V0Vmlld1NlbGVjdG9yKCk6IFhybS5Db250cm9scy5WaWV3U2VsZWN0b3Ige1xyXG4gICAgICAgIHJldHVybiB0aGlzLkdyaWRDb250cm9sLmdldFZpZXdTZWxlY3RvcigpO1xyXG4gICAgICB9XHJcbiAgICAgIG9wZW5SZWxhdGVkR3JpZCgpOiB2b2lkIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5HcmlkQ29udHJvbC5vcGVuUmVsYXRlZEdyaWQoKTtcclxuICAgICAgfVxyXG4gICAgICByZWZyZXNoKCk6IHZvaWQge1xyXG4gICAgICAgIHJldHVybiB0aGlzLkdyaWRDb250cm9sLnJlZnJlc2goKTtcclxuICAgICAgfVxyXG4gICAgICByZWZyZXNoUmliYm9uKCk6IHZvaWQge1xyXG4gICAgICAgIHJldHVybiB0aGlzLkdyaWRDb250cm9sLnJlZnJlc2hSaWJib24oKTtcclxuICAgICAgfVxyXG4gICAgICByZW1vdmVPbkxvYWQoaGFuZGxlcjogKCkgPT4gdm9pZCk6IHZvaWQge1xyXG4gICAgICAgIHJldHVybiB0aGlzLkdyaWRDb250cm9sLnJlbW92ZU9uTG9hZChoYW5kbGVyKTtcclxuICAgICAgfVxyXG4gICAgICBnZXRDb250cm9sVHlwZSgpOiBzdHJpbmcge1xyXG4gICAgICAgIHJldHVybiB0aGlzLkdyaWRDb250cm9sLmdldENvbnRyb2xUeXBlKCk7XHJcbiAgICAgIH1cclxuICAgICAgZ2V0TmFtZSgpOiBzdHJpbmcge1xyXG4gICAgICAgIHJldHVybiB0aGlzLkdyaWRDb250cm9sLmdldE5hbWUoKTtcclxuICAgICAgfVxyXG4gICAgICBnZXRQYXJlbnQoKTogWHJtLkNvbnRyb2xzLlNlY3Rpb24ge1xyXG4gICAgICAgIHJldHVybiB0aGlzLkdyaWRDb250cm9sLmdldFBhcmVudCgpO1xyXG4gICAgICB9XHJcbiAgICAgIGdldExhYmVsKCk6IHN0cmluZyB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuR3JpZENvbnRyb2wuZ2V0TGFiZWwoKTtcclxuICAgICAgfVxyXG4gICAgICBzZXRMYWJlbChsYWJlbDogc3RyaW5nKTogdm9pZCB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuR3JpZENvbnRyb2wuc2V0TGFiZWwobGFiZWwpO1xyXG4gICAgICB9XHJcbiAgICAgIGdldFZpc2libGUoKTogYm9vbGVhbiB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuR3JpZENvbnRyb2wuZ2V0VmlzaWJsZSgpO1xyXG4gICAgICB9XHJcbiAgICAgIHNldFZpc2libGUodmlzaWJsZTogYm9vbGVhbik6IHZvaWQge1xyXG4gICAgICAgIHJldHVybiB0aGlzLkdyaWRDb250cm9sLnNldFZpc2libGUodmlzaWJsZSk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9XHJcbn1cclxuIl19