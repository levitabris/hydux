import {
  ActionReturn,
  ActionState,
  ActionCmdReturn,
  ActionObjReturen,
  InitObjReturn,
  ActionType,
  ActionsType,
  InitReturn,
  AR,
  StandardActionReturn,
} from './types'
import Cmd, { CmdType, Sub } from './cmd'
import { set, merge, setDeep, setDeepMutable, get, isFn, noop, isPojo, clone, OverrideLength, weakVal } from './utils'
import { runActionResult } from './helpers'
import { dispatcher, inject } from './dispatcher'
export * from './helpers'
export * from './types'

export { set, merge, setDeep, Cmd, CmdType, Sub, ActionReturn, noop, isFn, isPojo, inject, dispatcher }

export type Init<S, A> = (...args: any[]) => InitReturn<S, A>
// todo: Remove back compatible optional ctx
export type View<S, A> = ((state: S, actions: A) => any)
export type Subscribe<S, A> = (state: S) => CmdType<A>
export type OnUpdate<S, A> = <M>(
  data: { prevAppState: S; nextAppState: S; msgData: M; action: string },
) => void
export type OnUpdateStart<S, A> = <M>(data: { action: string }) => void
export type Patch = <S, A>(path: string | string[], component: Component<S, A>, reuseState?: boolean) => Promise<any>

export interface AppProps<State, Actions> {
  init: Init<State, Actions>
  view: View<State, Actions>
  actions: ActionsType<State, Actions>
  subscribe?: Subscribe<State, Actions>
  // middlewares: ((action: MyAction<any, State, Actions>, key: string, path: string[]) => MyAction<any, State, Actions>)[],
  onRender?: (view: any, callback?: () => void) => void
  onUpdated?: OnUpdate<State, Actions>
  onUpdateStart?: OnUpdateStart<State, Actions>
  /**
   * Use mutable state, useful for high performance scenarios like graphics rendering, e.g. hydux-pixi
   */
  mutable?: boolean
}

export interface Component<State = any, Actions = any> {
  init: Init<State, Actions>
  view: View<State, Actions> | ((...args: any[]) => any)
  actions: ActionsType<State, Actions>
}

export interface Context<State, Actions, RenderReturn = any> {
  actions: Actions
  state: State
  init: Init<State, Actions>
  view: View<State, Actions>
  mutable?: boolean
  subscribe?: Subscribe<State, Actions>
  onRender?: ((view: any, callback?: () => void) => RenderReturn)
  onUpdated?: OnUpdate<State, Actions>
  onUpdateStart?: OnUpdateStart<State, Actions>
  /** Patch a component in runtime, used for code-splitting */
  patch: Patch
  render(state?: State): RenderReturn
}
export type App<State, Actions> = (props: AppProps<State, Actions>) => Context<State, Actions>
export type Enhancer<S, A> = (app: App<S, A>) => App<S, A>

function isObjReturn<S, A>(res: ActionReturn<S, A> | InitReturn<S, A>): res is InitObjReturn<S, A> | ActionObjReturen<S, A> {
  if (!res) return false
  const keys = Object.keys(res).sort().join('|')
  return ['', 'state', 'cmd', 'cmd|state', '0|1|cmd|state'].indexOf(keys) >= 0
}

function isCmdType<A>(res: any[]): res is CmdType<A> {
  return res.length === 0 || isFn(res[0])
}

export function normalize<S, A>(initResult: ActionReturn<S, A>, state: S): Required<ActionObjReturen<S, A>>
export function normalize<S, A>(initResult: InitReturn<S, A>): Required<InitObjReturn<S, A>>
export function normalize<S, A>(initResult: InitReturn<S, A> | ActionReturn<S, A>, state: S = {} as S): Required<ActionObjReturen<S, A> | InitObjReturn<S, A>> {
  let ret = {} as Required<ActionObjReturen<S, A> | InitObjReturn<S, A>>
  if (!initResult || (initResult['then'] && isFn(initResult['then']))) {
    let res = dispatcher.getResult()
    if (res) return res
    return { state, cmd: Cmd.none }
  }
  if (initResult instanceof Array) {
    if (isCmdType(initResult)) {
      ret = {
        state,
        cmd: initResult,
      }
    } else {
      ret = {
        state: initResult[0],
        cmd: initResult[1] || Cmd.none
      }
      let dispatcherResult = dispatcher.getResult()
      if (dispatcherResult) {
        if (state !== dispatcherResult.state) {
          ret.state = set({}, set(state, dispatcherResult.state))
        }
        ret.cmd.push(...dispatcherResult.cmd.filter(c => ret.cmd.indexOf(c) < 0))
      }
    }
  } else if (isObjReturn(initResult)) {
    ret = {
      state: initResult.state || state,
      cmd: initResult.cmd || Cmd.none,
    }
  } else {
    ret = {
      state: initResult,
      cmd: Cmd.none
    }
  }
  ret[0] = ret.state
  ret[1] = ret.cmd
  return ret
}

export function runCmd<A>(cmd: CmdType<A>, actions: A) {
  return cmd.map(sub => sub(actions))
}

export async function resolveCmdResults(results: any[]) {
  results = await Promise.all(
    results.map(r => r instanceof Array ? resolveCmdResults(r) : r)
  )
  return results
}

export function app<State, Actions>(props: AppProps<State, Actions>): Context<State, Actions> {
  // const appEvents = props.events || {}
  let appActions = {} as Actions
  const appSubscribe = props.subscribe || (_ => Cmd.none)
  const render = props.onRender || (noop as any)
  // const appMiddlewares = props.middlewares || []
  let { state: appState, cmd: initCmd } = normalize(props.init())
  init(appState, appActions, props.actions, [])
  runCmd(initCmd, appActions)
  appRender(appState)
  appSubscribe(appState).forEach(sub => sub(appActions))

  const appContext: Context<State, Actions> = {
    // getter should before spread operator,
    // otherwise it would be copied and becomes normal property
    get state() {
      return appState
    },
    ...props,
    actions: appActions,
    render: appRender,
    patch<S, A>(path: string, comp: Component<S, A>, reuseState = false): Promise<any> {
      reuseState = reuseState && appState[path]
      let { state, cmd } = normalize(comp.init())
      let actions = appActions[path]
      if (!actions) {
        actions = appActions[path] = {}
        init(state, actions, comp.actions as any, [path])
      }
      if (!reuseState) {
        appState = setDeep([path], state, appState)
      }
      appState = setDeep(['lazyComps', path], comp, appState)
      appRender(appState)
      return reuseState
        ? Promise.resolve()
        : resolveCmdResults(runCmd(cmd, actions))
    }
  }

  return appContext

  function appRender(state = appState, callback?: () => void) {
    if (state !== appState) {
      appState = state
    }
    let view = props.view(appState, appActions)
    if (isFn(view)) {
      view = view(appActions)
    }
    return render(view, callback)
  }

  function init(
    state,
    actions: any,
    from: ActionsType<State, Actions> | ActionType<any, State, Actions>,
    path: string[],
  ) {
    for (const key in from) {
      if (/^_/.test(key)) {
        continue
      }
      const subFrom = from[key]
      if (isFn(subFrom)) {
        actions[key] = function(...msgData) {
          state = get(path, appState)
          // action = appMiddlewares.reduce((action, fn) => fn(action, key, path), action)
          let parentState
          let parentActions
          let prevAppState = appState
          let batchingState = 'start' as 'start' | 'updating' | 'end'
          let setState = (nextState, callback?: () => void) => {
            if (batchingState === 'start') {
              batchingState = 'updating'
            }
            let isBatching = batchingState === 'updating'
            if (props.mutable) {
              appState = setDeepMutable(
                path,
                state !== nextState
                  ? set(state, nextState)
                  : state,
                appState,
              )
              if (!isBatching) {
                appRender(appState, callback)
              }
            } else if (nextState !== state) {
              appState = setDeep(path, merge(state, nextState), appState)
              if (!isBatching) {
                appRender(appState, callback)
              }
            }
            callback && callback()
          }
          let actionName = path.join('.') + '.' + key
          if (props.onUpdateStart) {
            props.onUpdateStart({
              action: actionName,
            })
          }
          {
            let offset = (weakVal<number>(subFrom, OverrideLength) || 2) - 1
            let pLen = path.length - offset
            if (pLen >= 0) {
              parentActions = get(path, appActions, pLen)
              parentState = get(path, appState, pLen)
            }
          }
          dispatcher.active({
            state,
            actions,
            parentState,
            parentActions,
            setState,
          })
          const actionResult = subFrom(...msgData)
          let cmd = dispatcher.getContext()._internals.cmd
          if (actionResult) {
            let ret = runActionResult(actionResult)
            setState(ret.state)
            cmd = ret.cmd
          }
          if (props.onUpdated) {
            props.onUpdated({
              prevAppState,
              nextAppState: appState,
              msgData: subFrom.length ? msgData : [],
              action: actionName,
            })
          }
          if (batchingState === 'updating') {
            appRender(appState)
          }
          batchingState = 'end'
          dispatcher.deactive()
          return runCmd(cmd, actions)
        }
      } else if (typeof subFrom === 'object' && subFrom) {
        init(
          state[key] || (state[key] = {}),
          actions[key] = clone(subFrom),
          subFrom,
          path.concat(key),
        )
      }
    }
  }
}

export default app
