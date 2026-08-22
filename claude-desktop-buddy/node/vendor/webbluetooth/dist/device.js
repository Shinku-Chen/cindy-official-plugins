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
exports.BluetoothDevice = void 0;
const server_1 = require("./server");
/**
 * Bluetooth Device class
 *
 * ### Events
 *
 * | Name | Event | Description |
 * | ---- | ----- | ----------- |
 * | `advertisementreceived` | {@link BluetoothAdvertisingEvent} | Advertisement received. |
 * | `characteristicvaluechanged` | Event | The value of a BLE Characteristic has changed. |
 * | `gattserverdisconnected` | Event | GATT server has been disconnected. |
 * | `serviceadded` | Event | A new service is available. |
 * | `servicechanged` | Event | An existing service has changed. |
 * | `serviceremoved` | Event | A service is unavailable. |
 */
class BluetoothDeviceImpl extends EventTarget {
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
    set onserviceadded(fn) {
        if (this._onserviceadded) {
            this.removeEventListener('serviceadded', this._onserviceadded);
            this._onserviceadded = undefined;
        }
        if (fn) {
            this._onserviceadded = fn;
            this.addEventListener('serviceadded', this._onserviceadded);
        }
    }
    set onservicechanged(fn) {
        if (this._onservicechanged) {
            this.removeEventListener('servicechanged', this._onservicechanged);
            this._onservicechanged = undefined;
        }
        if (fn) {
            this._onservicechanged = fn;
            this.addEventListener('servicechanged', this._onservicechanged);
        }
    }
    set onserviceremoved(fn) {
        if (this._onserviceremoved) {
            this.removeEventListener('serviceremoved', this._onserviceremoved);
            this._onserviceremoved = undefined;
        }
        if (fn) {
            this._onserviceremoved = fn;
            this.addEventListener('serviceremoved', this._onserviceremoved);
        }
    }
    set ongattserverdisconnected(fn) {
        if (this._ongattserverdisconnected) {
            this.removeEventListener('gattserverdisconnected', this._ongattserverdisconnected);
            this._ongattserverdisconnected = undefined;
        }
        if (fn) {
            this._ongattserverdisconnected = fn;
            this.addEventListener('gattserverdisconnected', this._ongattserverdisconnected);
        }
    }
    set onadvertisementreceived(fn) {
        if (this._onadvertisementreceived) {
            this.removeEventListener('advertisementreceived', this._onadvertisementreceived);
            this._onadvertisementreceived = undefined;
        }
        if (fn) {
            this._onadvertisementreceived = fn;
            this.addEventListener('advertisementreceived', this._onadvertisementreceived);
        }
    }
    /**
     * Device constructor
     * @param init A partial class to initialise values
     */
    constructor(init, bluetooth, allowedServices, forgetFn) {
        super();
        this.forgetFn = forgetFn;
        /**
         * Whether adverts are being watched (not implemented)
         */
        this.watchingAdvertisements = false;
        /**
         * @hidden
         */
        this._allowedServices = [];
        /**
         * @hidden
         */
        this._serviceUUIDs = [];
        this.id = init.id;
        this.name = init.name || `Unknown or Unsupported Device (${this.id})`;
        this._adData = init._adData;
        this._bluetooth = bluetooth;
        this._allowedServices = allowedServices;
        this._serviceUUIDs = init._serviceUUIDs;
        this.gatt = new server_1.BluetoothRemoteGATTServer(this);
    }
    /**
     * Starts watching adverts from this device (not implemented)
     */
    watchAdvertisements() {
        throw new Error('watchAdvertisements error: method not implemented');
    }
    /**
     * Stops watching adverts from this device (not implemented)
     */
    unwatchAdvertisements() {
        throw new Error('unwatchAdvertisements error: method not implemented');
    }
    /**
     * Forget this device
     */
    forget() {
        return __awaiter(this, void 0, void 0, function* () {
            this.forgetFn();
        });
    }
}
exports.BluetoothDevice = BluetoothDeviceImpl;
//# sourceMappingURL=device.js.map