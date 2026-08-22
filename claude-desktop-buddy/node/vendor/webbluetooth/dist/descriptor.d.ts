import { BluetoothRemoteGATTDescriptorInit } from './adapters/adapter';
/**
 * Bluetooth Remote GATT Descriptor class
 */
declare class BluetoothRemoteGATTDescriptorImpl implements BluetoothRemoteGATTDescriptor {
    /**
     * The characteristic the descriptor is related to
     */
    readonly characteristic: BluetoothRemoteGATTCharacteristic;
    /**
     * The unique identifier of the descriptor
     */
    readonly uuid: string;
    private _value;
    /**
     * The value of the descriptor
     */
    get value(): DataView | undefined;
    /**
     * @hidden
     */
    _handle: string;
    /**
     * Descriptor constructor
     * @param init A partial class to initialise values
     */
    constructor(init: BluetoothRemoteGATTDescriptorInit, characteristic: BluetoothRemoteGATTCharacteristic);
    /**
     * Gets the value of the descriptor
     * @returns Promise containing the value
     */
    readValue(): Promise<DataView>;
    /**
     * Updates the value of the descriptor
     * @param value The value to write
     */
    writeValue(value: ArrayBuffer | ArrayBufferView): Promise<void>;
}
export { BluetoothRemoteGATTDescriptorImpl as BluetoothRemoteGATTDescriptor };
