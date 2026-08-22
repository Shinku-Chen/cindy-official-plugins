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
exports.BluetoothRemoteGATTDescriptor = void 0;
const adapters_1 = require("./adapters");
/**
 * Bluetooth Remote GATT Descriptor class
 */
class BluetoothRemoteGATTDescriptorImpl {
    /**
     * The value of the descriptor
     */
    get value() {
        return this._value;
    }
    /**
     * Descriptor constructor
     * @param init A partial class to initialise values
     */
    constructor(init, characteristic) {
        this.characteristic = characteristic;
        this.uuid = init.uuid;
        this._handle = init._handle;
        this._value = init.value;
    }
    /**
     * Gets the value of the descriptor
     * @returns Promise containing the value
     */
    readValue() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            if (!((_a = this.characteristic.service.device.gatt) === null || _a === void 0 ? void 0 : _a.connected)) {
                throw new Error('readValue error: device not connected');
            }
            const dataView = yield adapters_1.adapter.readDescriptor(this._handle);
            this._value = dataView;
            return dataView;
        });
    }
    /**
     * Updates the value of the descriptor
     * @param value The value to write
     */
    writeValue(value) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            if (!((_a = this.characteristic.service.device.gatt) === null || _a === void 0 ? void 0 : _a.connected)) {
                throw new Error('writeValue error: device not connected');
            }
            const isView = (source) => source.buffer !== undefined;
            const arrayBuffer = isView(value) ? value.buffer : value;
            const dataView = new DataView(arrayBuffer);
            yield adapters_1.adapter.writeDescriptor(this._handle, dataView);
            this._value = dataView;
        });
    }
}
exports.BluetoothRemoteGATTDescriptor = BluetoothRemoteGATTDescriptorImpl;
//# sourceMappingURL=descriptor.js.map