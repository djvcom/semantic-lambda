export class ColdStartTracker {
  private coldStart = true

  isColdStart(): boolean {
    return this.coldStart
  }

  markWarm(): void {
    this.coldStart = false
  }

  reset(): void {
    this.coldStart = true
  }
}
