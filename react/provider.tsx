import { Store } from "../src/index";
import * as React from "react";
import * as PropTypes from "prop-types"

export interface StoreProviderProps {
    store: Store<{}>;
}

export class StoreProvider extends React.Component<StoreProviderProps, {}> {

    static childContextTypes = {
        reactiveStateStore: PropTypes.any
    }

    getChildContext() {
        return {
            reactiveStateStore: this.props.store as Store<{}>
        }
    }
    render() {
        return <div>{this.props.children}</div>;
    }

}