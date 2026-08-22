import { BluetoothDeviceInit } from './adapters/adapter';
import { BluetoothRemoteGATTServer } from './server';
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
declare class BluetoothDeviceImpl extends EventTarget implements BluetoothDevice {
    private forgetFn;
    /**
     * The unique identifier of the device
     */
    readonly id: string;
    /**
     * The name of the device
     */
    readonly name: string;
    /**
     * The gatt server of the device
     */
    readonly gatt: BluetoothRemoteGATTServer;
    /**
     * Whether adverts are being watched (not implemented)
     */
    readonly watchingAdvertisements: boolean;
    /**
     * @hidden
     */
    readonly _adData: {
        rssi?: number;
        txPower?: number;
        mtu?: number;
        serviceData?: BluetoothServiceData;
        manufacturerData?: BluetoothManufacturerData;
    };
    /**
     * @hidden
     */
    readonly _bluetooth: Bluetooth;
    /**
     * @hidden
     */
    readonly _allowedServices: Array<string>;
    /**
     * @hidden
     */
    readonly _serviceUUIDs: Array<string>;
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
    /**
     * Device constructor
     * @param init A partial class to initialise values
     */
    constructor(init: BluetoothDeviceInit, bluetooth: Bluetooth, allowedServices: string[], forgetFn: () => void);
    /**
     * Starts watching adverts from this device (not implemented)
     */
    watchAdvertisements(): Promise<void>;
    /**
     * Stops watching adverts from this device (not implemented)
     */
    unwatchAdvertisements(): Promise<void>;
    /**
     * Forget this device
     */
    forget(): Promise<void>;
}
export { BluetoothDeviceImpl as BluetoothDevice };
