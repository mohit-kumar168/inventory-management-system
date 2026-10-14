export default class apiResponse<T> {
  success = true

  constructor(
    public message: string,
    public data: T
  ) { }
}
