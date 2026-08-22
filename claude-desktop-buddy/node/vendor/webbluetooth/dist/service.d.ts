import { BluetoothDevice } from './device';
import { BluetoothRemoteGATTCharacteristic } from './characteristic';
import { BluetoothRemoteGATTServiceInit } from './adapters/adapter';
/**
 * Bluetooth Remote GATT Service class
 *
 * ### Events
 *
 * | Name | Event | Description |
 * | ---- | ----- | ----------- |
 * | `characteristicvaluechanged` | Event | The value of a BLE Characteristic has changed. |
 * | `serviceadded` | Event | A new service is available. |
 * | `servicechanged` | Event | An existing service has changed. |
 * | `serviceremoved` | Event | A service is unavailable. |
 */
declare class BluetoothRemoteGATTServiceImpl extends EventTarget implements BluetoothRemoteGATTService {
    /**
     * The device the service is related to
     */
    readonly device: BluetoothDevice;
    /**
     * The unique identifier of the service
     */
    readonly uuid: string;
    /**
     * Whether the service is a primary one
     */
    readonly isPrimary: boolean;
    /**
     * @hidden
     */
    _handle: string;
    private services;
    private characteristics;
    private _oncharacteristicvaluechanged;
    set oncharacteristicvaluechanged(fn: (ev: Event) => void);
    private _onserviceadded;
    set onserviceadded(fn: (ev: Event) => void);
    private _onservicechanged;
    set onservicechanged(fn: (ev: Event) => void);
    private _onserviceremoved;
    set onserviceremoved(fn: (ev: Event) => void);
    /**
     * Service constructor
     * @param init A partial class to initialise values
     */
    constructor(init: BluetoothRemoteGATTServiceInit, device: BluetoothDevice);
    /**
     * Gets a single characteristic contained in the service
     * @param characteristic characteristic UUID
     * @returns Promise containing the characteristic
     */
    getCharacteristic(characteristic: BluetoothCharacteristicUUID): Promise<BluetoothRemoteGATTCharacteristic>;
    /**
     * Gets a list of characteristics contained in the service
     * @param characteristic characteristic UUID
     * @returns Promise containing an array of characteristics
     */
    getCharacteristics(characteristic?: BluetoothCharacteristicUUID): Promise<Array<BluetoothRemoteGATTCharacteristic>>;
    /**
     * Gets a single service included in the service
     * @param service service UUID
     * @returns Promise containing the service
     */
    getIncludedService(service: BluetoothServiceUUID): Promise<BluetoothRemoteGATTService>;
    /**
     * Gets a list of services included in the service
     * @param service service UUID
     * @returns Promise containing an array of services
     */
    getIncludedServices(service?: BluetoothServiceUUID): Promise<Array<BluetoothRemoteGATTService>>;
}
export { BluetoothRemoteGATTServiceImpl as BluetoothRemoteGATTService };
