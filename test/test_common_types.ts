export interface ExampleState {
    counter: number;
    message?: string;
    bool?: boolean;
    someArray?: string[];
    someObject?: object;
}

export interface SliceState {
    foo: string;
    slice?: SliceState;
}

export interface RootState {
    slice?: SliceState;
}

export interface GenericState {
    value: any
}
