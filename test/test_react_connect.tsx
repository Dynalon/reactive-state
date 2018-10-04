import { expect } from "chai";
import * as Enzyme from "enzyme";
import "mocha";
import * as React from "react";
import { Subject, Subscription, Observable, of } from "rxjs";
import { take, skip } from "rxjs/operators";
import { ActionMap, connect, ConnectResult, StoreProvider } from "../react";
import { Store } from "../src/index";
import { setupJSDomEnv } from "./test_enzyme_helper";

const globalClicked = new Subject<void>();
const nextMessage = new Subject<string>();

export interface TestState {
    message: string;
    slice?: SliceState
}

export interface SliceState {
    sliceMessage: string;
}

export interface TestComponentProps {
    message: string;
    onClick: (arg1: any) => void;
}

export class TestComponent extends React.Component<TestComponentProps, {}> {
    render() {
        return <div>
            <h1>{this.props.message}</h1>
            <button onClick={this.props.onClick} />
        </div>
    }

    componentDidCatch() {

    }
}

function getConnectedComponent(connectResultOverride?: ConnectResult<TestState, TestComponentProps> | null) {
    return connect(TestComponent, (store: Store<TestState>) => {
        store.destroyed.subscribe(() => cleanup.unsubscribe())
        const props = store.createSlice("message").watch(message => ({ message }));
        const actionMap: ActionMap<TestComponent> = {
            onClick: globalClicked
        }
        if (connectResultOverride === null) {
            return {};
        }
        return {
            actionMap,
            props,
            ...connectResultOverride
        };
    })
}

let cleanup: Subscription;
describe("react bridge: connect() tests", () => {

    let store: Store<TestState>;
    let mountInsideStoreProvider: (elem: JSX.Element) => Enzyme.ReactWrapper<any, any>;
    let ConnectedTestComponent: any;

    const initialState: TestState = {
        message: "initialMessage",
        slice: {
            sliceMessage: "initialSliceMessage"
        }
    }

    beforeEach(() => {
        setupJSDomEnv();
        cleanup = new Subscription();
        ConnectedTestComponent = getConnectedComponent();
        store = Store.create(initialState);
        store.addReducer(nextMessage, (state, message) => {
            return {
                ...state,
                message
            }
        })
        store.destroyed.subscribe(() => cleanup.unsubscribe())
        mountInsideStoreProvider = (elem: JSX.Element) => Enzyme.mount(<StoreProvider store={store}>{elem}</StoreProvider>);
    })

    it("should map a prop from the state to the prop of the component using props observable", () => {
        const wrapper = mountInsideStoreProvider(<ConnectedTestComponent />);
        const messageText = wrapper.find("h1").text();
        expect(messageText).to.equal(initialState.message);
    });

    it("should receive prop updates from the store using mapStateToProps", () => {
        const wrapper = mountInsideStoreProvider(<ConnectedTestComponent />);
        expect(wrapper.find("h1").text()).to.equal(initialState.message);

        nextMessage.next("Message1");
        expect(wrapper.find("h1").text()).to.equal("Message1");

        nextMessage.next("Message2");
        expect(wrapper.find("h1").text()).to.equal("Message2");
    });


    it("should trigger an action on a callback function in the actionMap", done => {
        const wrapper = mountInsideStoreProvider(<ConnectedTestComponent />);
        globalClicked.pipe(take(1)).subscribe(() => {
            expect(true).to.be.true;
            done();
        });
        wrapper.find("button").simulate("click");
    });

    it("should allow to override props on the connected component", done => {
        const onClick = () => {
            done();
        };
        const wrapper = mountInsideStoreProvider(<ConnectedTestComponent message="Barfoos" onClick={onClick} />);

        const messageText = wrapper.find("h1").text();
        expect(messageText).to.equal("Barfoos");
        wrapper.find("button").simulate("click");
    })

    it("should use the provided props if there is no store in context", (done) => {
        const clicked = new Subject<void>();
        const onClick = () => setTimeout(() => done(), 50);
        clicked.subscribe(() => {
            done("Error: called the subject");
        })
        const wrapper = Enzyme.mount(<ConnectedTestComponent message="Barfoos" onClick={onClick} />);
        const messageText = wrapper.find("h1").text();
        expect(messageText).to.equal("Barfoos");
        wrapper.find("button").simulate("click");
        wrapper.unmount();
    })

    it("should use a props if it updated later on", done => {
        const Root: React.SFC<{ message?: string }> = (props) => {
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
        cleanup.add(() => done());
        const wrapper = mountInsideStoreProvider(<ConnectedTestComponent />);
        wrapper.unmount();
    })

    it("should allow the connect callback to return empty result object and then use the provided props", (done) => {
        ConnectedTestComponent = getConnectedComponent(null);
        const onClick = () => done();
        const wrapper = mountInsideStoreProvider(<ConnectedTestComponent message="Bla" onClick={onClick} />);
        const textMessage = wrapper.find("h1").text();
        expect(textMessage).to.equal("Bla");
        wrapper.find("button").simulate("click");
    })

    it("should allow an observer in an actionMap", done => {
        const onClick = new Subject<void>();
        const actionMap: ActionMap<TestComponent> = {
            onClick
        };
        onClick.subscribe(() => done());
        ConnectedTestComponent = getConnectedComponent({ actionMap });
        const wrapper = mountInsideStoreProvider(<ConnectedTestComponent />);
        wrapper.find("button").simulate("click");
    })

    it("should allow callback functions in an actionMap", done => {
        const actionMap: ActionMap<TestComponent> = {
            onClick: () => done()
        };
        ConnectedTestComponent = getConnectedComponent({ actionMap });
        const wrapper = mountInsideStoreProvider(<ConnectedTestComponent />);
        wrapper.find("button").simulate("click");
    })

    it("should throw an error for invalid entries in the action map", () => {
        const actionMap: ActionMap<TestComponent> = {
            onClick: (5 as any)
        };
        expect(() => {
            ConnectedTestComponent = getConnectedComponent({ actionMap });
            const wrapper = mountInsideStoreProvider(<ConnectedTestComponent />);
            wrapper.find("button").simulate("click");
        }).to.throw();
    })

    it("should allow undefined fields in an actionMap to ignore callbacks", done => {
        const actionMap: ActionMap<TestComponent> = {
            onClick: undefined
        };
        ConnectedTestComponent = getConnectedComponent({ actionMap });
        cleanup.add(() => done());
        const wrapper = mountInsideStoreProvider(<ConnectedTestComponent />);
        wrapper.find("button").simulate("click");
        wrapper.unmount();
    })

    // Typing regression
    it("should be possible for props to operate on any store/slice", () => {
        const ConnectedTestComponent = connect(TestComponent, (store: Store<TestState>) => {
            const slice = store.createSlice("message", "Blafoo");
            const props = slice.watch(message => ({ message }))

            return {
                props
            }
        });

        const wrapper = mountInsideStoreProvider(<ConnectedTestComponent />);
        const messageText = wrapper.find("h1").text();
        expect(messageText).to.equal("Blafoo")
    })

    it("should be possible to add additional props to a connected component and subscribe to it in the connect callback", (done) => {
        type ComponentProps = { message: string }
        const Component: React.SFC<ComponentProps> = (props) => <h1>{props.message}</h1>;

        // add another prop field to our component
        type InputProps = ComponentProps & { additionalProp: number };
        const ConnectedTestComponent = connect(Component, (store: Store<TestState>, inputProps: Observable<InputProps>) => {
            inputProps.pipe(
                take(1)
            ).subscribe(props => {
                expect(props).to.deep.equal({ test: 1 })
            })

            inputProps.pipe(
                skip(1),
                take(1)
            ).subscribe(props => {
                expect(props).to.deep.equal({ test: 2 })
                setTimeout(() => done(), 100);
            })
            return {
                props: of({ message: "Foobar" })
            }
        })

        const Root: React.SFC<any> = (props: any) => <StoreProvider store={store}><ConnectedTestComponent {...props} /></StoreProvider>;
        const wrapper = Enzyme.mount(<Root test={1} />)
        wrapper.setProps({
            test: 2
        });
        const messageText = wrapper.find("h1").text();
        expect(messageText).to.equal("Foobar")
        wrapper.unmount();
    })

    // this is a compilation test to assert that the type inference for connect() works when manually specifing type arguments
    it("should be possible to infer the inputProps type", done => {
        type ComponentProps = { message: string };
        const Component: React.SFC<ComponentProps> = (props) => <h1>{props.message}</h1>;

        // add another prop field to our component
        type InputProps = ComponentProps & { additionalProp: number };
        const ConnectedTestComponent = connect<TestState, InputProps, ComponentProps>(Component, (store, inputProps) => {
            const props = of({ message: "Foobar", additionalProp: 5 })
            return { props }
        })
        console.info(ConnectedTestComponent)
        done();
    })
})
