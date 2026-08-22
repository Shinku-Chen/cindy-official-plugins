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
exports.SimplebleAdapter = void 0;
const uuid_1 = require("../uuid");
const simpleble_1 = require("./simpleble");
/**
 * @hidden
 */
class PeripheralHandles {
    constructor(peripherals) {
        this.peripherals = peripherals;
        this.handleCounter = 0;
        this.peripheralChildren = new Map();
        this.children = new Map();
        this.parents = new Map();
        this.services = new Map();
        this.characteristics = new Map();
        this.descriptors = new Map();
        this.characteristicEvents = new Map();
    }
    createHandles(peripheral) {
        const services = [];
        for (const service of peripheral.services) {
            const serviceHandle = `${this.handleCounter++}`;
            this.parents.set(serviceHandle, peripheral.address);
            this.services.set(serviceHandle, service);
            services.push(serviceHandle);
            const characteristics = [];
            for (const characteristic of service.characteristics) {
                const characteristicHandle = `${this.handleCounter++}`;
                this.parents.set(characteristicHandle, serviceHandle);
                this.characteristics.set(characteristicHandle, characteristic);
                characteristics.push(characteristicHandle);
                const descriptors = [];
                for (const descriptor of characteristic.descriptors) {
                    const descHandle = `${this.handleCounter++}`;
                    this.parents.set(descHandle, characteristicHandle);
                    this.descriptors.set(descHandle, descriptor);
                    descriptors.push(descHandle);
                }
                this.children.set(characteristicHandle, descriptors);
            }
            this.children.set(serviceHandle, characteristics);
        }
        this.children.set(peripheral.address, services);
    }
    deleteHandles(peripheral) {
        const children = this.peripheralChildren.get(peripheral);
        if (children) {
            for (const child of children) {
                this.children.delete(child);
                this.parents.delete(child);
                this.services.delete(child);
                this.characteristics.delete(child);
                this.descriptors.delete(child);
                this.characteristicEvents.delete(child);
            }
        }
        this.peripheralChildren.delete(peripheral);
    }
    getServices(deviceHandle) {
        const children = this.children.get(deviceHandle);
        const services = {};
        if (children) {
            for (const child of children) {
                const service = this.services.get(child);
                if (service) {
                    services[child] = service;
                }
            }
        }
        return services;
    }
    getCharacteristics(serviceHandle) {
        const children = this.children.get(serviceHandle);
        const characteristics = {};
        if (children) {
            for (const child of children) {
                const characteristic = this.characteristics.get(child);
                if (characteristic) {
                    characteristics[child] = characteristic;
                }
            }
        }
        const peripheralHandle = this.parents.get(serviceHandle);
        if (!peripheralHandle) {
            throw new Error('Peripheral not found for service');
        }
        const peripheral = this.peripherals.get(peripheralHandle);
        if (!peripheral) {
            throw new Error('Peripheral not found for service');
        }
        const service = this.services.get(serviceHandle);
        if (!service) {
            throw new Error('Service not found');
        }
        return {
            peripheral,
            service,
            characteristics
        };
    }
    getDescriptors(characteristicHandle) {
        const children = this.children.get(characteristicHandle);
        const descriptors = {};
        if (children) {
            for (const child of children) {
                const descriptor = this.descriptors.get(child);
                if (descriptor) {
                    descriptors[child] = descriptor;
                }
            }
        }
        return descriptors;
    }
    getCharacteristicGraph(characteristicHandle) {
        const serviceHandle = this.parents.get(characteristicHandle);
        if (!serviceHandle) {
            throw new Error('Service not found for characteristic');
        }
        const peripheralHandle = this.parents.get(serviceHandle);
        if (!peripheralHandle) {
            throw new Error('Peripheral not found for characteristic');
        }
        const peripheral = this.peripherals.get(peripheralHandle);
        if (!peripheral) {
            throw new Error('Peripheral not found for characteristic');
        }
        const service = this.services.get(serviceHandle);
        if (!service) {
            throw new Error('Service not found for characteristic');
        }
        const characteristic = this.characteristics.get(characteristicHandle);
        if (!characteristic) {
            throw new Error('Characteristic not found');
        }
        return {
            peripheral,
            service,
            characteristic
        };
    }
    getDescriptorGraph(descriptorHandle) {
        const characteristicHandle = this.parents.get(descriptorHandle);
        if (!characteristicHandle) {
            throw new Error('Characteristic not found for descriptor');
        }
        const serviceHandle = this.parents.get(characteristicHandle);
        if (!serviceHandle) {
            throw new Error('Service not found for descriptor');
        }
        const peripheralHandle = this.parents.get(serviceHandle);
        if (!peripheralHandle) {
            throw new Error('Peripheral not found for descriptor');
        }
        const peripheral = this.peripherals.get(peripheralHandle);
        if (!peripheral) {
            throw new Error('Peripheral not found for descriptor');
        }
        const service = this.services.get(serviceHandle);
        if (!service) {
            throw new Error('Service not found for descriptor');
        }
        const characteristic = this.characteristics.get(characteristicHandle);
        if (!characteristic) {
            throw new Error('Characteristic not found for descriptor');
        }
        const descriptor = this.descriptors.get(descriptorHandle);
        if (!descriptor) {
            throw new Error('Descriptor not found');
        }
        return {
            peripheral,
            service,
            characteristic,
            descriptor
        };
    }
}
/**
 * @hidden
 */
class SimplebleAdapter extends EventTarget {
    constructor() {
        super(...arguments);
        this.peripherals = new Map();
        this.handles = new PeripheralHandles(this.peripherals);
    }
    validDevice(device, serviceUUIDs) {
        if (serviceUUIDs.length === 0) {
            // Match any device
            return true;
        }
        if (!device._serviceUUIDs) {
            // No advertised services, no match
            return false;
        }
        const advertisedUUIDs = device._serviceUUIDs.map((serviceUUID) => uuid_1.BluetoothUUID.canonicalUUID(serviceUUID));
        // An advertised UUID matches our search UUIDs
        return serviceUUIDs.some(serviceUUID => advertisedUUIDs.indexOf(serviceUUID) >= 0);
    }
    buildBluetoothDevice(device) {
        const name = device.identifier;
        const address = device.address;
        const rssi = device.rssi;
        const txPower = device.txPower;
        const id = address || `${name}`;
        const serviceUUIDs = [];
        const serviceData = new Map();
        for (const service of device.services) {
            serviceUUIDs.push(service.uuid);
            if (service.data) {
                serviceData.set(service.uuid, service.data);
            }
        }
        const manufacturerData = new Map();
        for (const id in device.manufacturerData) {
            manufacturerData.set(id, new DataView(device.manufacturerData[id].buffer));
        }
        return {
            id,
            name,
            _serviceUUIDs: serviceUUIDs,
            _adData: {
                rssi,
                txPower,
                serviceData,
                manufacturerData
            }
        };
    }
    get state() {
        const adapterEnabled = (0, simpleble_1.isEnabled)();
        return !!adapterEnabled;
    }
    getEnabled() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.state;
        });
    }
    getAdapters() {
        const adapters = (0, simpleble_1.getAdapters)();
        return adapters.map(({ address, active }, index) => ({ index, address, active }));
    }
    useAdapter(index) {
        const adapters = (0, simpleble_1.getAdapters)();
        const selected = adapters[index];
        if (!selected) {
            throw new Error(`Adapter ${index} not found.`);
        }
        this.adapter = selected;
    }
    startScan(serviceUUIDs, foundFn) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.state === false) {
                throw new Error('adapter not enabled');
            }
            if (!this.adapter) {
                this.adapter = (0, simpleble_1.getAdapters)()[0];
            }
            const foundPeripherals = [];
            this.adapter.setCallbackOnScanFound(peripheral => {
                const device = this.buildBluetoothDevice(peripheral);
                if (this.validDevice(device, serviceUUIDs)) {
                    if (!foundPeripherals.includes(device.id)) {
                        foundPeripherals.push(device.id);
                        this.peripherals.set(device.id, peripheral);
                        // Only call the found function the first time we find a valid device
                        foundFn(device);
                    }
                }
            });
            const success = this.adapter.scanStart();
            if (!success) {
                throw new Error('scan start failed');
            }
        });
    }
    stopScan(_errorFn) {
        if (this.adapter) {
            const success = this.adapter.scanStop();
            if (!success) {
                throw new Error('scan stop failed');
            }
        }
    }
    connect(handle, disconnectFn) {
        return __awaiter(this, void 0, void 0, function* () {
            const peripheral = this.peripherals.get(handle);
            if (!peripheral) {
                throw new Error('Peripheral not found');
            }
            if (!peripheral.connectable) {
                throw new Error('Connection not possible');
            }
            const success = peripheral.connect();
            if (!success) {
                throw new Error('Connect failed');
            }
            if (disconnectFn) {
                peripheral.setCallbackOnDisconnected(() => disconnectFn());
            }
            this.handles.createHandles(peripheral);
        });
    }
    disconnect(handle) {
        return __awaiter(this, void 0, void 0, function* () {
            const peripheral = this.peripherals.get(handle);
            if (!peripheral) {
                throw new Error('Peripheral not found');
            }
            const success = peripheral.disconnect();
            if (!success) {
                throw new Error('Disconnect failed');
            }
            this.handles.deleteHandles(peripheral);
        });
    }
    discoverServices(handle, serviceUUIDs) {
        return __awaiter(this, void 0, void 0, function* () {
            const services = this.handles.getServices(handle);
            const discovered = [];
            for (const [handle, service] of Object.entries(services)) {
                if (!serviceUUIDs || serviceUUIDs.length === 0 || serviceUUIDs.indexOf(service.uuid) >= 0) {
                    discovered.push({
                        _handle: handle,
                        uuid: service.uuid,
                        isPrimary: true
                    });
                }
            }
            return discovered;
        });
    }
    discoverIncludedServices(_handle, _serviceUUIDs) {
        return __awaiter(this, void 0, void 0, function* () {
            // Currently not implemented
            return [];
        });
    }
    discoverCharacteristics(handle, characteristicUUIDs) {
        return __awaiter(this, void 0, void 0, function* () {
            const { peripheral, service, characteristics } = this.handles.getCharacteristics(handle);
            const discovered = [];
            for (const [handle, characteristic] of Object.entries(characteristics)) {
                const charUUID = uuid_1.BluetoothUUID.canonicalUUID(characteristic.uuid);
                if (!characteristicUUIDs || characteristicUUIDs.length === 0 || characteristicUUIDs.indexOf(charUUID) >= 0) {
                    discovered.push({
                        _handle: handle,
                        uuid: charUUID,
                        properties: {
                            // Not all of these are supported in SimpleBle
                            broadcast: false, // characteristic.capabilities.includes('???'),
                            read: characteristic.canRead,
                            write: characteristic.canWriteRequest, // Request includes a response
                            writeWithoutResponse: characteristic.canWriteCommand, // Command is 'fire and forget'
                            notify: characteristic.canNotify,
                            indicate: characteristic.canIndicate,
                            authenticatedSignedWrites: false, // characteristic.capabilities.includes('???'),
                            reliableWrite: false, // characteristic.capabilities.includes('???'),
                            writableAuxiliaries: false // characteristic.capabilities.includes('???'),
                        }
                    });
                    if (characteristic.canIndicate) {
                        peripheral.indicate(service.uuid, charUUID, data => {
                            if (this.handles.characteristicEvents.has(handle)) {
                                const event = this.handles.characteristicEvents.get(handle);
                                if (event) {
                                    event(new DataView(data.buffer));
                                }
                            }
                        });
                    }
                    if (characteristic.canNotify) {
                        peripheral.notify(service.uuid, charUUID, data => {
                            if (this.handles.characteristicEvents.has(handle)) {
                                const event = this.handles.characteristicEvents.get(handle);
                                if (event) {
                                    event(new DataView(data.buffer));
                                }
                            }
                        });
                    }
                }
            }
            return discovered;
        });
    }
    discoverDescriptors(handle, descriptorUUIDs) {
        return __awaiter(this, void 0, void 0, function* () {
            const descriptors = this.handles.getDescriptors(handle);
            const discovered = new Array();
            for (const [handle, descriptor] of Object.entries(descriptors)) {
                const descUUID = uuid_1.BluetoothUUID.canonicalUUID(descriptor);
                if (!descriptorUUIDs || descriptorUUIDs.length === 0 || descriptorUUIDs.indexOf(descUUID) >= 0) {
                    discovered.push({
                        _handle: handle,
                        uuid: descUUID
                    });
                }
            }
            return discovered;
        });
    }
    readCharacteristic(handle) {
        return __awaiter(this, void 0, void 0, function* () {
            const { peripheral, service, characteristic } = this.handles.getCharacteristicGraph(handle);
            const data = peripheral.read(service.uuid, characteristic.uuid);
            return new DataView(data.buffer);
        });
    }
    writeCharacteristic(handle, value, withoutResponse) {
        return __awaiter(this, void 0, void 0, function* () {
            const { peripheral, service, characteristic } = this.handles.getCharacteristicGraph(handle);
            let success = false;
            if (withoutResponse) {
                // Command is 'fire and forget'
                success = peripheral.writeCommand(service.uuid, characteristic.uuid, new Uint8Array(value.buffer));
            }
            else {
                // Request includes a response
                success = peripheral.writeRequest(service.uuid, characteristic.uuid, new Uint8Array(value.buffer));
            }
            if (!success) {
                throw new Error('Write failed');
            }
        });
    }
    enableNotify(handle, notifyFn) {
        return __awaiter(this, void 0, void 0, function* () {
            this.handles.characteristicEvents.set(handle, notifyFn);
        });
    }
    disableNotify(handle) {
        return __awaiter(this, void 0, void 0, function* () {
            this.handles.characteristicEvents.delete(handle);
        });
    }
    readDescriptor(handle) {
        return __awaiter(this, void 0, void 0, function* () {
            const { peripheral, service, characteristic, descriptor } = this.handles.getDescriptorGraph(handle);
            const data = peripheral.readDescriptor(service.uuid, characteristic.uuid, descriptor);
            if (!data) {
                throw new Error('Read failed');
            }
            return new DataView(data.buffer);
        });
    }
    writeDescriptor(handle, value) {
        return __awaiter(this, void 0, void 0, function* () {
            const { peripheral, service, characteristic, descriptor } = this.handles.getDescriptorGraph(handle);
            const success = peripheral.writeDescriptor(service.uuid, characteristic.uuid, descriptor, new Uint8Array(value.buffer));
            if (!success) {
                throw new Error('Write failed');
            }
        });
    }
}
exports.SimplebleAdapter = SimplebleAdapter;
//# sourceMappingURL=simpleble-adapter.js.map