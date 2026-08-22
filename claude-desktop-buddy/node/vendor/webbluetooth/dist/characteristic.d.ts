import { BluetoothRemoteGATTDescriptor } from './descriptor';
import { BluetoothRemoteGATTService } from './service';
import { BluetoothRemoteGATTCharacteristicInit } from './adapters/adapter';
/**
 * Bluetooth Remote GATT Characteristic class
 *
 * ### Events
 *
 * | Name | Event | Description |
 * | ---- | ----- | ----------- |
 * | `characteristicvaluechanged` | Event | The value of a BLE Characteristic has changed. |
 */
declare class BluetoothRemoteGATTCharacteristicImpl extends EventTarget implements BluetoothRemoteGATTCharacteristic {
    /**
     * The service the characteristic is related to
     */
    readonly service: BluetoothRemoteGATTService;
    /**
     * The unique identifier of the characteristic
     */
    readonly uuid: string;
    /**
     * The properties of the characteristic
     */
    readonly properties: BluetoothCharacteristicProperties;
    private _value;
    /**
     * The value of the characteristic
     */
    get value(): DataView | undefined;
    /**
     * @hidden
     */
    _handle: string;
    private descriptors;
    private _oncharacteristicvaluechanged;
    set oncharacteristicvaluechanged(fn: (ev: Event) => void);
    /**
     * Characteristic constructor
     * @param init A partial class to initialise values
     */
    constructor(init: BluetoothRemoteGATTCharacteristicInit, service: BluetoothRemoteGATTService);
    private setValue;
    /**
     * Gets a single characteristic descriptor
     * @param descriptor descriptor UUID
     * @returns Promise containing the descriptor
     */
    getDescriptor(descriptor: string | number): Promise<BluetoothRemoteGATTDescriptor>;
    /**
     * Gets a list of the characteristic's descriptors
     * @param descriptor descriptor UUID
     * @returns Promise containing an array of descriptors
     */
    getDescriptors(descriptor?: string | number): Promise<Array<BluetoothRemoteGATTDescriptor>>;
    /**
     * Gets the value of the characteristic
     * @returns Promise containing the value
     */
    readValue(): Promise<DataView>;
    /**
     * Updates the value of the characteristic
     * @param value The value to write
     */
    writeValue(value: ArrayBuffer | ArrayBufferView, withoutResponse?: boolean): Promise<void>;
    /**
     * Updates the value of the characteristic and waits for a response
     * @param value The value to write
     */
    writeValueWithResponse(value: ArrayBuffer | ArrayBufferView): Promise<void>;
    /**
     * Updates the value of the characteristic without waiting for a response
     * @param value The value to write
     */
    writeValueWithoutResponse(value: ArrayBuffer | ArrayBufferView): Promise<void>;
    /**
     * Start notifications of changes for the characteristic
     * @returns Promise containing the characteristic
     */
    startNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
    /**
     * Stop notifications of changes for the characteristic
     * @returns Promise containing the characteristic
     */
    stopNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
}
export { BluetoothRemoteGATTCharacteristicImpl as BluetoothRemoteGATTCharacteristic };
