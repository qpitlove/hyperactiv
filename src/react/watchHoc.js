import React from 'react'
import hyperactiv from '../../src/index'
import { useStore } from './hooks/index'
const { computed, dispose } = hyperactiv

/**
 *  Wraps a class component and automatically updates it when the store mutates.
 * @param {*} Component The component to wrap
 */
const watchClassComponent = Component => new Proxy(Component, {
    construct: function(Target, argumentsList) {
        // Create a new Component instance
        const instance = new Target(...argumentsList)
        // Ensures that the forceUpdate in correctly bound
        instance.forceUpdate = instance.forceUpdate.bind(instance)
        // Monkey patch the componentWillUnmount method to do some clean up on destruction
        const originalUnmount =
            typeof instance.componentWillUnmount === 'function' &&
            instance.componentWillUnmount.bind(instance)
        instance.componentWillUnmount = function(...args) {
            dispose(instance.forceUpdate)
            if(originalUnmount) {
                originalUnmount(...args)
            }
        }
        // Return a proxified Component
        return new Proxy(instance, {
            get: function(target, property) {
                if(property === 'render') {
                    // Compute the render function and forceUpdate on changes
                    return computed(target.render.bind(target), { autoRun: false, callback: instance.forceUpdate })
                }
                return target[property]
            }
        })
    }
})

/**
 *  Wraps a functional component and automatically updates it when the store mutates.
 * @param {*} Component The component to wrap
 */
function watchFunctionalComponent(Component) {
    const wrapper = props => {
        const [, forceUpdate ] = React.useState()
        const store = useStore()
        const injectedProps = props.store ? props : { ...props, store }
        const mounted = React.useRef(true)
        const wrappedComponent = React.useMemo(() =>
            computed(Component, {
                autoRun: false,
                callback: function() {
                    mounted.current && forceUpdate({})
                }
            }), [Component])
        React.useEffect(() => () => {
            dispose(wrappedComponent)
        }, [wrappedComponent])
        React.useEffect(() => () => {
            mounted.current = false
        }, [])
        return wrappedComponent(injectedProps)
    }
    wrapper.displayName = Component.displayName || Component.name
    return wrapper
}

/**
 *  Wraps a component and automatically updates it when the store mutates.
 * @param {*} Component The component to wrap
 */
export const watch = Component =>
    typeof Component === 'function' &&
    (!Component.prototype || !Component.prototype.isReactComponent) ?
        watchFunctionalComponent(Component) :
        watchClassComponent(Component)
