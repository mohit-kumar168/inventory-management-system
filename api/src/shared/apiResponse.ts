export default class ApiResponse<T> {
  success = true

  constructor(
    public message: string,
    public data: T
  ) { }
}
