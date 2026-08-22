import { BluetoothDevice } from './device';
/**
 * Bluetooth Options interface
 */
export interface BluetoothOptions {
    /**
     * A `device found` callback function to allow the user to select a device
     */
    deviceFound?: (device: BluetoothDevice, selectFn: () => void) => boolean;
    /**
     * The amount of seconds to scan for the device (default is 10)
     */
    scanTime?: number;
    /**
     * Optional flag to automatically allow all devices
     */
    allowAllDevices?: boolean;
    /**
     * An optional referring device
     */
    referringDevice?: BluetoothDevice;
    /**
     * An optional index of bluetooth adapter to use
     */
    adapterIndex?: number;
}
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
declare class BluetoothImpl extends EventTarget implements Bluetooth {
    private options;
    /**
     * Referring device for the bluetooth instance
     */
    readonly referringDevice?: BluetoothDevice;
    private scanner;
    private deviceFound;
    private scanTime;
    private allowedDevices;
    /**
     * Bluetooth constructor
     * @param options Bluetooth initialisation options
     */
    constructor(options?: BluetoothOptions);
    private _oncharacteristicvaluechanged;
    set oncharacteristicvaluechanged(fn: (ev: Event) => void);
    private _onserviceadded;
    set onserviceadded(fn: (ev: Event) => void);
    private _onservicechanged;
    set onservicechanged(fn: (ev: Event) => void);
    private _onserviceremoved;
    set onserviceremoved(fn: (ev: Event) => void);
    private _ongattserverdisconnected;
    set ongattserverdisconnected(fn: (ev: Event) => void);
    private _onadvertisementreceived;
    set onadvertisementreceived(fn: (ev: Event) => void);
    private _onavailabilitychanged;
    set onavailabilitychanged(fn: (ev: Event) => void);
    private filterDevice;
    private forgetDevice;
    /**
     * Gets the availability of a bluetooth adapter
     * @returns Promise containing a flag indicating bluetooth availability
     */
    getAvailability(): Promise<boolean>;
    /**
     * Scans for a device matching optional filters
     * @param options The options to use when scanning
     * @returns Promise containing a device which matches the options
     */
    requestDevice(options?: RequestDeviceOptions): Promise<BluetoothDevice>;
    /**
     * Get all bluetooth devices
     */
    getDevices(): Promise<BluetoothDevice[]>;
    /**
     * Cancels the scan for devices
     */
    cancelRequest(): void;
    /**
     * @hidden
     * Request LE scan (not implemented)
     */
    requestLEScan(_options?: BluetoothLEScanOptions): Promise<BluetoothLEScan>;
}
export { BluetoothImpl as Bluetooth };
/**
 * List available bluetooth adapters
 */
export declare const getAdapters: () => Array<{
    index: number;
    address: string;
    active: boolean;
}>;
