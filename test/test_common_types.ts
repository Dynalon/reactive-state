
export interface CounterState {
    counter: number;
}

export interface SliceState {
    foo: string;
}
export interface RootState {
    slice?: SliceState;
}