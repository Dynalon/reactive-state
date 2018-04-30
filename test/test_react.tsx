import * as React from "react";
import "mocha";
import { expect } from "chai";

import { Subject, Subscription } from "rxjs";
import { map, take } from "rxjs/operators";
import { Action, Store, Reducer } from "../src/index";
import { connect, ConnectResult, MapStateToProps, StoreProvider, ActionMap } from "../react"
import * as Enzyme from "enzyme";
import { setupJSDomEnv } from "./test_enzyme_helper";

const clicked = new Subject<void>();

interface TestState {
    message: string;
}
interface TestComponentProps {
    message: string;
    onClick: (arg1: any) => void;
}

class TestComponent extends React.Component<TestComponentProps, {}> {
    render() {
        return <div>
            <h1>{this.props.message}</h1>
            <button onClick={this.props.onClick} />
        </div>
    }
}

function getConnectedComponent(connectResultOverride?: ConnectResult<TestState, TestComponentProps, TestState> | null) {
    return connect(TestComponent, (store: Store<TestState>) => {
        const mapStateToProps: MapStateToProps<TestState, TestComponent> = (state) => {
            return {
                message: state.message
            }
        }
        const actionMap: ActionMap<TestComponent> = {
            onClick: clicked
        }
        if (connectResultOverride === null) {
            return;
        }
        return {
            actionMap,
            mapStateToProps,
            ...connectResultOverride
        }
    })
}

describe("connect() tests", () => {

    let store: Store<TestState>;
    let mount: (elem: JSX.Element) => Enzyme.ReactWrapper<any, any>;
    let ConnectedTestComponent: any;
    let cleanupSubscription: Subscription;

    const initialState: TestState = Object.freeze({
        message: "Foobar"
    })

    beforeEach(() => {
        setupJSDomEnv();
        cleanupSubscription = new Subscription();
        ConnectedTestComponent = getConnectedComponent({ cleanupSubscription });
        store = Store.create(initialState);
        mount = (elem: JSX.Element) => Enzyme.mount(<StoreProvider store={store}>{elem}</StoreProvider>);
    })

    it("should map a props from the state to the props using mapStateToProps", () => {
        const wrapper = mount(<ConnectedTestComponent />);
        const messageText = wrapper.find("h1").text();
        expect(messageText).to.equal(initialState.message);
    });

    it("should trigger an action on a callback function in the actionMap", done => {
        const wrapper = mount(<ConnectedTestComponent />);
        clicked.pipe(take(1)).subscribe(() => {
            expect(true).to.be.true;
            done();
        });
        wrapper.find("button").simulate("click");
    });

    it("should allow to override props on the connected component", done => {
        const onClick = () => {
            done();
        };
        const wrapper = mount(<ConnectedTestComponent message="Barfoos" onClick={onClick} />);

        const messageText = wrapper.find("h1").text();
        expect(messageText).to.equal("Barfoos");
        wrapper.find("button").simulate("click");
    })

    it("should use the provided props if there is no store in context", (done) => {
        const onClick = () => setTimeout(() => done(), 50);
        clicked.subscribe(() => {
            done("Error: called the subject");
        })
        const wrapper = Enzyme.mount(<ConnectedTestComponent message="Barfoos" onClick={onClick} />);
        const messageText = wrapper.find("h1").text();
        expect(messageText).to.equal("Barfoos");
        wrapper.find("button").simulate("click");
    })

    it("should use a props if it updated later on", done => {
        const Root: React.SFC<{ message?: string }> = (props) =>  {
            return <StoreProvider store={store}><ConnectedTestComponent message={props.message} /></StoreProvider>
        };
        const wrapper = Enzyme.mount(<Root />);
        const textMessage = wrapper.find("h1").text();
        // we provided a message props - even though its undefined at first, its mere presence should supersede the
        // connected prop of message
        expect(textMessage).to.equal("");
        setTimeout(() => {
            wrapper.setProps({ message: "Bla" });
            const textMessage = wrapper.find("h1").text();
            expect(textMessage).to.equal("Bla");
            done();
        }, 50)
    })

    it("unsubscribe the cleanup subscription on component unmount", (done) => {
        cleanupSubscription.add(() => done());
        const wrapper = mount(<ConnectedTestComponent />);
        wrapper.unmount();
    })

    it("should allow the connect callback to return undefined and then use the provided props", (done) => {
        ConnectedTestComponent = getConnectedComponent(null);
        const onClick = () => done();
        const wrapper = mount(<ConnectedTestComponent message="Bla" onClick={onClick} />);
        const textMessage = wrapper.find("h1").text();
        expect(textMessage).to.equal("Bla");
        wrapper.find("button").simulate("click");
    })

    it("should allow mapStateToProps to return undefined", done => {
        const mapStateToProps: MapStateToProps<TestState, TestComponent> = (state) => {
            return undefined;
        }
        ConnectedTestComponent = getConnectedComponent({ mapStateToProps });
        const onClick = () => done();
        const wrapper = mount(<ConnectedTestComponent message="Bla" onClick={onClick} />);
        const textMessage = wrapper.find("h1").text();
        wrapper.find("button").simulate("click");
    })

    it("should allow mapStateToProps to return void", done => {
        const mapStateToProps: MapStateToProps<TestState, TestComponent> = (state) => {
            return;
        }
        ConnectedTestComponent = getConnectedComponent({ mapStateToProps });
        const onClick = () => done();
        const wrapper = mount(<ConnectedTestComponent message="Bla" onClick={onClick} />);
        const textMessage = wrapper.find("h1").text();
        wrapper.find("button").simulate("click");
    })

    it("should allow callback functions in an actionMap", done => {
        const actionMap: ActionMap<TestComponent> = {
            onClick: () => done()
        };
        ConnectedTestComponent = getConnectedComponent({ actionMap, mapStateToProps: undefined });
        const wrapper = mount(<ConnectedTestComponent />);
        wrapper.find("button").simulate("click");
    })

    it("should allow undefined fields in an actionMap to ignore callbacks", done => {
        const actionMap: ActionMap<TestComponent> = {
            onClick: undefined
        };
        ConnectedTestComponent = getConnectedComponent({ actionMap, cleanupSubscription });
        cleanupSubscription.add(() => done());
        const wrapper = mount(<ConnectedTestComponent />);
        wrapper.find("button").simulate("click");
        wrapper.unmount();
    })


})