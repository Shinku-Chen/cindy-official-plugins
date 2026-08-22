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
exports.BluetoothRemoteGATTCharacteristic = void 0;
const adapters_1 = require("./adapters");
const descriptor_1 = require("./descriptor");
const uuid_1 = require("./uuid");
const isView = (source) => source.buffer !== undefined;
/**
 * Bluetooth Remote GATT Characteristic class
 *
 * ### Events
 *
 * | Name | Event | Description |
 * | ---- | ----- | ----------- |
 * | `characteristicvaluechanged` | Event | The value of a BLE Characteristic has changed. |
 */
class BluetoothRemoteGATTCharacteristicImpl extends EventTarget {
    /**
     * The value of the characteristic
     */
    get value() {
        return this._value;
    }
    set oncharacteristicvaluechanged(fn) {
        if (this._oncharacteristicvaluechanged) {
            this.removeEventListener('characteristicvaluechanged', this._oncharacteristicvaluechanged);
            this._oncharacteristicvaluechanged = undefined;
        }
        if (fn) {
            this._oncharacteristicvaluechanged = fn;
            this.addEventListener('characteristicvaluechanged', this._oncharacteristicvaluechanged);
        }
    }
    /**
     * Characteristic constructor
     * @param init A partial class to initialise values
     */
    constructor(init, service) {
        super();
        this.service = service;
        this.uuid = init.uuid;
        this.properties = init.properties;
        this._handle = init._handle;
        this._value = init.value;
    }
    setValue(value, emit) {
        if (value) {
            this._value = value;
            if (emit) {
                this.dispatchEvent(new CustomEvent('characteristicvaluechanged', { bubbles: true }));
                this.service.dispatchEvent(new CustomEvent('characteristicvaluechanged', { bubbles: true }));
                this.service.device.dispatchEvent(new CustomEvent('characteristicvaluechanged', { bubbles: true }));
                this.service.device._bluetooth.dispatchEvent(new CustomEvent('characteristicvaluechanged', { bubbles: true }));
            }
        }
    }
    /**
     * Gets a single characteristic descriptor
     * @param descriptor descriptor UUID
     * @returns Promise containing the descriptor
     */
    getDescriptor(descriptor) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.service.device.gatt.connected) {
                throw new Error('getDescriptor error: device not connected');
            }
            if (!descriptor) {
                throw new Error('getDescriptor error: no descriptor specified');
            }
            const descriptors = yield this.getDescriptors(descriptor);
            if (descriptors.length !== 1) {
                throw new Error('getDescriptor error: descriptor not found');
            }
            return descriptors[0];
        });
    }
    /**
     * Gets a list of the characteristic's descriptors
     * @param descriptor descriptor UUID
     * @returns Promise containing an array of descriptors
     */
    getDescriptors(descriptor) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.service.device.gatt.connected) {
                throw new Error('getDescriptors error: device not connected');
            }
            if (!this.descriptors) {
                const descriptors = yield adapters_1.adapter.discoverDescriptors(this._handle);
                this.descriptors = descriptors.map(descriptorInfo => {
                    return new descriptor_1.BluetoothRemoteGATTDescriptor(descriptorInfo, this);
                });
            }
            if (!descriptor) {
                return this.descriptors;
            }
            const filtered = this.descriptors.filter(descriptorObject => descriptorObject.uuid === uuid_1.BluetoothUUID.getDescriptor(descriptor));
            if (filtered.length !== 1) {
                throw new Error('getDescriptors error: descriptor not found');
            }
            return filtered;
        });
    }
    /**
     * Gets the value of the characteristic
     * @returns Promise containing the value
     */
    readValue() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.service.device.gatt.connected) {
                throw new Error('readValue error: device not connected');
            }
            const dataView = yield adapters_1.adapter.readCharacteristic(this._handle);
            this.setValue(dataView, true);
            return dataView;
        });
    }
    /**
     * Updates the value of the characteristic
     * @param value The value to write
     */
    writeValue(value_1) {
        return __awaiter(this, arguments, void 0, function* (value, withoutResponse = false) {
            if (!this.service.device.gatt.connected) {
                throw new Error('writeValue error: device not connected');
            }
            const arrayBuffer = isView(value) ? value.buffer : value;
            const dataView = new DataView(arrayBuffer);
            yield adapters_1.adapter.writeCharacteristic(this._handle, dataView, withoutResponse);
            this.setValue(dataView);
        });
    }
    /**
     * Updates the value of the characteristic and waits for a response
     * @param value The value to write
     */
    writeValueWithResponse(value) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.writeValue(value, false);
        });
    }
    /**
     * Updates the value of the characteristic without waiting for a response
     * @param value The value to write
     */
    writeValueWithoutResponse(value) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.writeValue(value, true);
        });
    }
    /**
     * Start notifications of changes for the characteristic
     * @returns Promise containing the characteristic
     */
    startNotifications() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.service.device.gatt.connected) {
                throw new Error('startNotifications error: device not connected');
            }
            yield adapters_1.adapter.enableNotify(this._handle, dataView => {
                this.setValue(dataView, true);
            });
            return this;
        });
    }
    /**
     * Stop notifications of changes for the characteristic
     * @returns Promise containing the characteristic
     */
    stopNotifications() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.service.device.gatt.connected) {
                throw new Error('stopNotifications error: device not connected');
            }
            yield adapters_1.adapter.disableNotify(this._handle);
            return this;
        });
    }
}
exports.BluetoothRemoteGATTCharacteristic = BluetoothRemoteGATTCharacteristicImpl;
//# sourceMappingURL=characteristic.js.map