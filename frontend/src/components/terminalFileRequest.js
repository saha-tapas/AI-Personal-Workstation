let nextRequestId = 0

export function createTerminalFileRequest(request, openedProject) {
  return { ...request, project: request.project || openedProject, id: ++nextRequestId }
}

export function consumeTerminalFileRequest(request, activeProject, consumedId) {
  if (!request || request.project !== activeProject || request.id === consumedId) {
    return { shouldConsume: false, consumedId }
  }
  return { shouldConsume: true, consumedId: request.id }
}

export function clearCursorTargetAfterFailure(target, failedTarget) {
  if (!target || !failedTarget || target.project !== failedTarget.project || target.path !== failedTarget.path || target.requestId === undefined || target.requestId !== failedTarget.requestId) return target
  return null
}
