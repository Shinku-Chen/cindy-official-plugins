"use strict";
/*
* Node Web Bluetooth
* Copyright (c) 2026 Rob Moran
*
* The MIT License (MIT)
*
* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files (the "Software"), to deal
* in the Software without restriction, including without limitation the rights
* to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
* copies of the Software, and to permit persons to whom the Software is
* furnished to do so, subject to the following conditions:
*
* The above copyright notice and this permission notice shall be included in all
* copies or substantial portions of the Software.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
* IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
* FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
* AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
* LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
* OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
* SOFTWARE.
*/
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BluetoothRemoteGATTServer = void 0;
const uuid_1 = require("./uuid");
const adapters_1 = require("./adapters");
const service_1 = require("./service");
/**
 * Bluetooth Remote GATT Server class
 */
class BluetoothRemoteGATTServerImpl {
    /**
     * Whether the gatt server is connected
     */
    get connected() {
        return this._connected;
    }
    /**
     * Server constructor
     * @param device Device the gatt server relates to
     */
    constructor(device) {
        this._connected = false;
        this.device = device;
        this._handle = this.device.id;
    }
    /**
     * Connect the gatt server
     * @returns Promise containing the gatt server
     */
    connect() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.connected) {
                throw new Error('connect error: device already connected');
            }
            yield adapters_1.adapter.connect(this._handle, () => {
                this.services = undefined;
                this._connected = false;
                this.device.dispatchEvent(new CustomEvent('gattserverdisconnected', { bubbles: true }));
                this.device._bluetooth.dispatchEvent(new CustomEvent('gattserverdisconnected', { bubbles: true }));
            });
            this._connected = true;
            return this;
        });
    }
    /**
     * Disconnect the gatt server
     */
    disconnect() {
        adapters_1.adapter.disconnect(this._handle);
        this._connected = false;
    }
    /**
     * Gets a single primary service contained in the gatt server
     * @param service service UUID
     * @returns Promise containing the service
     */
    getPrimaryService(service) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.connected) {
                throw new Error('getPrimaryService error: device not connected');
            }
            if (!service) {
                throw new Error('getPrimaryService error: no service specified');
            }
            const services = yield this.getPrimaryServices(service);
            if (services.length !== 1) {
                throw new Error('getPrimaryService error: service not found');
            }
            return services[0];
        });
    }
    /**
     * Gets a list of primary services contained in the gatt server
     * @param service service UUID
     * @returns Promise containing an array of services
     */
    getPrimaryServices(service) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.connected) {
                throw new Error('getPrimaryServices error: device not connected');
            }
            if (!this.services) {
                const services = yield adapters_1.adapter.discoverServices(this._handle, this.device._allowedServices);
                this.services = services.map(serviceInfo => {
                    return new service_1.BluetoothRemoteGATTService(serviceInfo, this.device);
                });
            }
            if (!service) {
                return this.services;
            }
            const filtered = this.services.filter(serviceObject => serviceObject.uuid === uuid_1.BluetoothUUID.getService(service));
            if (filtered.length !== 1) {
                throw new Error('getPrimaryServices error: service not found');
            }
            return filtered;
        });
    }
}
exports.BluetoothRemoteGATTServer = BluetoothRemoteGATTServerImpl;
//# sourceMappingURL=server.js.map