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
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAdapters = exports.Bluetooth = void 0;
const adapters_1 = require("./adapters");
const device_1 = require("./device");
const uuid_1 = require("./uuid");
/**
 * Bluetooth class
 *
 * ### Events
 *
 * | Name | Event | Description |
 * | ---- | ----- | ----------- |
 * | `advertisementreceived` | {@link BluetoothAdvertisingEvent} | Advertisement received. |
 * | `availabilitychanged` | Event | Bluetooth availability changed. |
 * | `characteristicvaluechanged` | Event | The value of a BLE Characteristic has changed. |
 * | `gattserverdisconnected` | Event | GATT server has been disconnected. |
 * | `serviceadded` | Event | A new service is available. |
 * | `servicechanged` | Event | An existing service has changed. |
 * | `serviceremoved` | Event | A service is unavailable. |
 */
class BluetoothImpl extends EventTarget {
    /**
     * Bluetooth constructor
     * @param options Bluetooth initialisation options
     */
    constructor(options = {}) {
        super();
        this.options = options;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.scanner = undefined;
        this.scanTime = 10.24 * 1000;
        this.allowedDevices = new Set();
        this.referringDevice = options.referringDevice;
        this.deviceFound = options.deviceFound;
        if (options.scanTime) {
            this.scanTime = options.scanTime * 1000;
        }
        if (typeof options.adapterIndex === 'number') {
            adapters_1.adapter.useAdapter(options.adapterIndex);
        }
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
    set onavailabilitychanged(fn) {
        if (this._onavailabilitychanged) {
            // adapter.removeEventListener(EVENT_ENABLED, this._onavailabilitychanged);
            this._onavailabilitychanged = undefined;
        }
        if (fn) {
            this._onavailabilitychanged = fn;
            // adapter.addEventListener(EVENT_ENABLED, this._onavailabilitychanged);
        }
        throw new Error('onavailabilitychanged error: method not implemented');
    }
    filterDevice(filters, deviceInfo, validServices) {
        let valid = false;
        filters.forEach(filter => {
            // Name
            if (filter.name && filter.name !== deviceInfo.name)
                return;
            // NamePrefix
            if (filter.namePrefix) {
                if (!deviceInfo.name || filter.namePrefix.length > deviceInfo.name.length)
                    return;
                if (filter.namePrefix !== deviceInfo.name.substr(0, filter.namePrefix.length))
                    return;
            }
            // Services
            if (filter.services) {
                const serviceUUIDs = filter.services.map(uuid_1.BluetoothUUID.getService);
                const servicesValid = serviceUUIDs.every(serviceUUID => {
                    return (deviceInfo._serviceUUIDs.indexOf(serviceUUID) > -1);
                });
                if (!servicesValid)
                    return;
                validServices = validServices.concat(serviceUUIDs);
            }
            // Service Data
            if (filter.serviceData) {
                if (!deviceInfo._adData.serviceData)
                    return;
                const services = [...deviceInfo._adData.serviceData.keys()];
                for (const entry of filter.serviceData) {
                    if (!services.includes(entry.service))
                        return;
                }
            }
            // Manufacturer Data
            if (filter.manufacturerData) {
                if (!deviceInfo._adData.manufacturerData)
                    return;
                const manufacturers = [...deviceInfo._adData.manufacturerData.keys()];
                for (const entry of filter.manufacturerData) {
                    if (!manufacturers.includes(entry.companyIdentifier))
                        return;
                }
            }
            valid = true;
        });
        if (!valid)
            return undefined;
        return deviceInfo;
    }
    forgetDevice(uuid) {
        this.allowedDevices.delete(uuid);
    }
    /**
     * Gets the availability of a bluetooth adapter
     * @returns Promise containing a flag indicating bluetooth availability
     */
    getAvailability() {
        return adapters_1.adapter.getEnabled();
    }
    /**
     * Scans for a device matching optional filters
     * @param options The options to use when scanning
     * @returns Promise containing a device which matches the options
     */
    requestDevice(options = { filters: [] }) {
        if (this.scanner !== undefined) {
            throw new Error('requestDevice error: request in progress');
        }
        const isFiltered = (maybeFiltered) => maybeFiltered.filters !== undefined;
        const isAcceptAll = (maybeAcceptAll) => maybeAcceptAll.acceptAllDevices === true;
        let searchUUIDs = [];
        if (isFiltered(options)) {
            // Must have a filter
            if (options.filters.length === 0) {
                throw new TypeError('requestDevice error: no filters specified');
            }
            // Don't allow empty filters
            const emptyFilter = options.filters.some(filter => {
                return (Object.keys(filter).length === 0);
            });
            if (emptyFilter) {
                throw new TypeError('requestDevice error: empty filter specified');
            }
            // Don't allow empty namePrefix
            const emptyPrefix = options.filters.some(filter => {
                return (typeof filter.namePrefix !== 'undefined' && filter.namePrefix === '');
            });
            if (emptyPrefix) {
                throw new TypeError('requestDevice error: empty namePrefix specified');
            }
            options.filters.forEach(filter => {
                if (filter.services)
                    searchUUIDs = searchUUIDs.concat(filter.services.map(uuid_1.BluetoothUUID.getService));
                // Unique-ify
                searchUUIDs = searchUUIDs.filter((item, index, array) => {
                    return array.indexOf(item) === index;
                });
            });
        }
        else if (!isAcceptAll(options)) {
            throw new TypeError('requestDevice error: specify filters or acceptAllDevices');
        }
        return new Promise((resolve, reject) => {
            let found = false;
            this.scanner = setTimeout(() => {
                this.cancelRequest();
                if (!found) {
                    reject('requestDevice error: no devices found');
                }
            }, this.scanTime);
            adapters_1.adapter.startScan(searchUUIDs, initialInfo => {
                let deviceInfo = initialInfo;
                let validServices = [];
                const complete = (bluetoothDevice) => {
                    this.allowedDevices.add(bluetoothDevice.id);
                    this.cancelRequest();
                    resolve(bluetoothDevice);
                };
                // filter devices if filters specified
                if (isFiltered(options)) {
                    deviceInfo = this.filterDevice(options.filters, deviceInfo, validServices);
                }
                if (deviceInfo) {
                    found = true;
                    // Add additional services
                    if (options.optionalServices) {
                        validServices = validServices.concat(options.optionalServices.map(uuid_1.BluetoothUUID.getService));
                    }
                    // Set unique list of allowed services
                    const allowedServices = validServices.filter((item, index, array) => {
                        return array.indexOf(item) === index;
                    });
                    const bluetoothDevice = new device_1.BluetoothDevice(deviceInfo, this, allowedServices, () => this.forgetDevice(deviceInfo.id));
                    const selectFn = () => {
                        complete.call(this, bluetoothDevice);
                    };
                    if (!this.deviceFound || this.deviceFound(bluetoothDevice, selectFn.bind(this)) === true) {
                        // If no deviceFound function, or deviceFound returns true, resolve with this device immediately
                        complete.call(this, bluetoothDevice);
                    }
                }
            });
        });
    }
    /**
     * Get all bluetooth devices
     */
    getDevices() {
        if (this.scanner !== undefined) {
            throw new Error('getDevices error: request in progress');
        }
        return new Promise(resolve => {
            const devices = [];
            this.scanner = setTimeout(() => {
                this.cancelRequest();
                resolve(devices);
            }, this.scanTime);
            adapters_1.adapter.startScan([], deviceInfo => {
                if (this.options.allowAllDevices || this.allowedDevices.has(deviceInfo.id)) {
                    const bluetoothDevice = new device_1.BluetoothDevice(deviceInfo, this, [], () => this.forgetDevice(deviceInfo.id));
                    devices.push(bluetoothDevice);
                }
            });
        });
    }
    /**
     * Cancels the scan for devices
     */
    cancelRequest() {
        if (this.scanner) {
            clearTimeout(this.scanner);
            this.scanner = undefined;
            adapters_1.adapter.stopScan();
        }
    }
    /**
     * @hidden
     * Request LE scan (not implemented)
     */
    requestLEScan(_options) {
        throw new Error('requestLEScan error: method not implemented.');
    }
}
exports.Bluetooth = BluetoothImpl;
/**
 * List available bluetooth adapters
 */
exports.getAdapters = adapters_1.adapter.getAdapters;
//# sourceMappingURL=bluetooth.js.map