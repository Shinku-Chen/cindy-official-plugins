import { Adapter as BluetoothAdapter, BluetoothDeviceInit, BluetoothRemoteGATTServiceInit, BluetoothRemoteGATTCharacteristicInit, BluetoothRemoteGATTDescriptorInit } from './adapter';
/**
 * @hidden
 */
export declare class SimplebleAdapter extends EventTarget implements BluetoothAdapter {
    private adapter;
    private peripherals;
    private handles;
    private validDevice;
    private buildBluetoothDevice;
    private get state();
    getEnabled(): Promise<boolean>;
    getAdapters(): Array<{
        index: number;
        address: string;
        active: boolean;
    }>;
    useAdapter(index: number): void;
    startScan(serviceUUIDs: Array<string>, foundFn: (device: BluetoothDeviceInit) => void): Promise<void>;
    stopScan(_errorFn?: (errorMsg: string) => void): void;
    connect(handle: string, disconnectFn?: () => void): Promise<void>;
    disconnect(handle: string): Promise<void>;
    discoverServices(handle: string, serviceUUIDs?: Array<string>): Promise<Array<BluetoothRemoteGATTServiceInit>>;
    discoverIncludedServices(_handle: string, _serviceUUIDs?: Array<string>): Promise<Array<BluetoothRemoteGATTServiceInit>>;
    discoverCharacteristics(handle: string, characteristicUUIDs?: Array<string>): Promise<Array<BluetoothRemoteGATTCharacteristicInit>>;
    discoverDescriptors(handle: string, descriptorUUIDs?: Array<string>): Promise<Array<BluetoothRemoteGATTDescriptorInit>>;
    readCharacteristic(handle: string): Promise<DataView>;
    writeCharacteristic(handle: string, value: DataView, withoutResponse: boolean): Promise<void>;
    enableNotify(handle: string, notifyFn: (value: DataView) => void): Promise<void>;
    disableNotify(handle: string): Promise<void>;
    readDescriptor(handle: string): Promise<DataView>;
    writeDescriptor(handle: string, value: DataView): Promise<void>;
}
