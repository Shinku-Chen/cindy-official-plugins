export declare const BluetoothUUID: {
    getService: (name: string | number) => string;
    getCharacteristic: (name: string | number) => string;
    getDescriptor: (name: string | number) => string;
    canonicalUUID: (alias: string | number) => string;
};
