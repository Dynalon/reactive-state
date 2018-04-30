import * as React from "react";
import { Store } from "../src/store"
import { Subject } from "rxjs";
import { connect, MapStateToProps } from "./connect"
import { ActionMap } from "./actions"

interface TestState {
    bla: string;
}

interface TestProps {
    foo: string;
    callback1: () => void,
    callback2: (n: number) => number;
    callback3: (n: number, p: string) => number;
}

class TestComponent extends React.Component<TestProps, {}> {
    render() { return null; }
}

const TestComponentSFC: React.SFC<TestProps> = (props) => {
    return null;
}
const mapStateToProps: MapStateToProps<TestState, TestComponent> = (state: TestState) => {
    return {
        foo: "foo"
    };
}

const actionMap: ActionMap<TestComponent> = {
    callback1: function() {
    },
    callback2: new Subject<number>(),
    callback3: new Subject<number>(),
    // thse don't work:
    // first argument of callback3 is number, incompatible to string
    // callback3: new Subject<string>(),
}

const ConnectedTestComponent = connect(TestComponent, (store: Store<TestState>) => {
    return {
        actionMap,
        mapStateToProps
    }
})

const ConnectedTestComponentSFC = connect(TestComponentSFC, (store: Store<TestState>) => {
    return {
        actionMap,
        mapStateToProps
    }
})

console.info(ConnectedTestComponent);
console.info(ConnectedTestComponentSFC);
