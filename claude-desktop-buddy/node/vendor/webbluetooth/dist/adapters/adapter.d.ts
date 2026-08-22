export interface BluetoothDeviceInit {
    id: string;
    name: string;
    _serviceUUIDs: Array<string>;
    _adData: Partial<BluetoothAdvertisingEvent>;
}
export interface BluetoothRemoteGATTServiceInit {
    _handle: string;
    uuid: string;
    isPrimary: boolean;
}
export interface BluetoothRemoteGATTCharacteristicInit {
    _handle: string;
    uuid: string;
    properties: BluetoothCharacteristicProperties;
    value?: DataView;
}
export interface BluetoothRemoteGATTDescriptorInit {
    _handle: string;
    uuid: string;
    value?: DataView;
}
/**
 * @hidden
 */
export interface Adapter extends EventTarget {
    getEnabled: () => Promise<boolean>;
    getAdapters: () => Array<{
        index: number;
        address: string;
        active: boolean;
    }>;
    useAdapter: (index: number) => void;
    startScan: (serviceUUIDs: Array<string>, foundFn: (device: BluetoothDeviceInit) => void) => Promise<void>;
    stopScan: () => void;
    connect: (handle: string, disconnectFn?: () => void) => Promise<void>;
    disconnect: (handle: string) => Promise<void>;
    discoverServices: (handle: string, serviceUUIDs?: Array<string>) => Promise<Array<BluetoothRemoteGATTServiceInit>>;
    discoverIncludedServices: (handle: string, serviceUUIDs?: Array<string>) => Promise<Array<BluetoothRemoteGATTServiceInit>>;
    discoverCharacteristics: (handle: string, characteristicUUIDs?: Array<string>) => Promise<Array<BluetoothRemoteGATTCharacteristicInit>>;
    discoverDescriptors: (handle: string, descriptorUUIDs?: Array<string>) => Promise<Array<BluetoothRemoteGATTDescriptorInit>>;
    readCharacteristic: (handle: string) => Promise<DataView>;
    writeCharacteristic: (handle: string, value: DataView, withoutResponse: boolean) => Promise<void>;
    enableNotify: (handle: string, notifyFn: (value: DataView) => void) => Promise<void>;
    disableNotify: (handle: string) => Promise<void>;
    readDescriptor: (handle: string) => Promise<DataView>;
    writeDescriptor: (handle: string, value: DataView) => Promise<void>;
}
