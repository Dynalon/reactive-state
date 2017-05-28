export interface CounterState {
    counter: number;
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
