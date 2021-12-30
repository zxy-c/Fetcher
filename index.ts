import CancelablePromise from "cancelable-promise";

const qs = require('qs');
type ParamsSerializer = (params: RequestParams) => string;
export type  FetcherOptions = FetcherCommonOptions & {
    paramsSerializer?: ParamsSerializer;
    requestInterceptors?: RequestInterceptor[]
    responseInterceptors?: ResponseInterceptor[]
    errorInterceptors?: ErrorInterceptor[]
}

export type ErrorInterceptor = (errorResponse: ErrorResponse) => void

export type ResponseInterceptor = (response: Response) => void

export type RequestInterceptor = (request: Request) => Request

export type FetcherCommonOptions = {
    timeout?: number
}

export type Request = {
    url: string
    headers: Headers
    params: RequestParams
    body: any | null
}

export default class Fetcher {

    private readonly paramsSerializer: ParamsSerializer
    readonly timeout: number
    private readonly requestInterceptors: RequestInterceptor[]
    private readonly responseInterceptors: ResponseInterceptor[]
    private readonly errorInterceptors: ErrorInterceptor[]

    static readonly defaultOptions = {
        paramsSerializer: ((p: RequestParams) => {
            return qs.stringify(p, {arrayFormat: 'repeat', skipNulls: true, strictNullHandling: true})
        }),
        timeout: 30000
    }

    constructor(readonly baseUrl: string | null, options: FetcherOptions = {}) {
        this.paramsSerializer = options.paramsSerializer ?? Fetcher.defaultOptions.paramsSerializer
        this.timeout = options.timeout ?? Fetcher.defaultOptions.timeout
        this.requestInterceptors = options?.requestInterceptors ?? []
        this.responseInterceptors = options?.responseInterceptors ?? []
        this.errorInterceptors = options?.errorInterceptors ?? []
    }


    // noinspection JSUnusedGlobalSymbols
    addRequestInterceptor(requestInterceptor: RequestInterceptor) {
        this.requestInterceptors.push(requestInterceptor)
    }

    // noinspection JSUnusedGlobalSymbols
    addResponseInterceptor(responseInterceptor: ResponseInterceptor) {
        this.responseInterceptors.push(responseInterceptor)
    }

    // noinspection JSUnusedGlobalSymbols
    addErrorInterceptor(errorInterceptor: ErrorInterceptor) {
        this.errorInterceptors.push(errorInterceptor)
    }

    // noinspection JSUnusedGlobalSymbols
    post<D = any, R = Response<D>>(url: string, params: RequestParams = {}, body?: any | null, options?: RequestOptions): CancelablePromise<R> {
        return this.execute(HttpMethod.POST, url, params, body, options)
    }

    // noinspection JSUnusedGlobalSymbols
    put<D = any, R = Response<D>>(url: string, params: RequestParams = {}, body?: any | null, options?: RequestOptions): CancelablePromise<R> {
        return this.execute(HttpMethod.PUT, url, params, body, options)
    }

    // noinspection JSUnusedGlobalSymbols
    patch<D = any, R = Response<D>>(url: string, params: RequestParams = {}, body?: any | null, options?: RequestOptions): CancelablePromise<R> {
        return this.execute(HttpMethod.PATCH, url, params, body, options)
    }

    // noinspection JSUnusedGlobalSymbols
    get<D = any, R = Response<D>>(url: string, params: RequestParams = {}, options?: RequestOptions): CancelablePromise<R> {
        return this.execute(HttpMethod.GET, url, params, null, options)
    }

    // noinspection JSUnusedGlobalSymbols
    delete<D = any, R = Response<D>>(url: string, params: RequestParams = {}, options?: RequestOptions): CancelablePromise<R> {
        return this.execute(HttpMethod.DELETE, url, params, null, options)
    }

    // noinspection JSUnusedGlobalSymbols
    head<D = any, R = Response<D>>(url: string, params: RequestParams = {}, options?: RequestOptions): CancelablePromise<R> {
        return this.execute(HttpMethod.HEAD, url, params, null, options)
    }

    // noinspection JSUnusedGlobalSymbols
    trace<D = any, R = Response<D>>(url: string, params: RequestParams = {}, options?: RequestOptions): CancelablePromise<R> {
        return this.execute(HttpMethod.TRACE, url, params, null, options)
    }

    // noinspection JSUnusedGlobalSymbols
    options<D = any, R = Response<D>>(url: string, params: RequestParams = {}, options?: RequestOptions): CancelablePromise<R> {
        return this.execute(HttpMethod.OPTIONS, url, params, null, options)
    }

    execute<D = any, R = Response<D>>(method: HttpMethod = HttpMethod.GET, url: string, params: RequestParams = {}, body?: any | null, options?: RequestOptions): CancelablePromise<R> {
        const headersObject = options?.headers ?? {}
        const headers = new Headers()
        for (let headerKey in headersObject) {
            const headerValue = headersObject[headerKey];
            if (typeof headerValue === "string") {
                headers.append(headerKey, headerValue)
            } else {
                for (let v of headerValue) {
                    headers.append(headerKey, v)
                }
            }
        }

        const paramsSerializer = this.paramsSerializer;
        const timeout = options?.timeout ?? this.timeout;

        const abortController = new AbortController();


        const baseUrl = this.baseUrl ?? ""
        url = baseUrl.replace(/\/$/, "") + "/" + url.replace(/^\//, "")
        const paramString = paramsSerializer(params);
        url = paramString ? url + "?" + paramString : url
        let request: Request = {url, headers, params, body}
        for (let requestInterceptor of this.requestInterceptors) {
            request = requestInterceptor(request)
        }
        if (abortController.signal.aborted) {
            throw CancelablePromise.reject("canceled")
        }
        return new CancelablePromise<R>((resolve, reject, onCancel) => {
            let timeoutTimeout: NodeJS.Timeout | null = null
            if (timeout >= 0) {
                // Never timeout if timeout is zero
                timeoutTimeout = setTimeout(() => {
                    abortController.abort()
                    reject ("timeout")
                }, timeout)
            }
            onCancel(() => {
                abortController.abort();
                timeoutTimeout&&clearTimeout(timeoutTimeout)
            })
            fetch(request.url, {...request,signal:abortController.signal,method}).then(fetchResponse => {
                const status = fetchResponse.status
                const responseType = options?.responseType;
                let dataPromise: Promise<any>
                if (responseType != null) {
                    switch (responseType) {
                        case ResponseType.JSON:
                            dataPromise = fetchResponse.json()
                            break;
                        case ResponseType.FORM_DATA:
                            dataPromise = fetchResponse.formData()
                            break;
                        case ResponseType.TEXT:
                            dataPromise = fetchResponse.text()
                            break;
                        case ResponseType.BLOB:
                            dataPromise = fetchResponse.blob()
                            break;
                        case ResponseType.ARRAY_BUFFER:
                            dataPromise = fetchResponse.arrayBuffer()
                            break;
                    }
                } else if (fetchResponse.headers.get("Content-Type")?.includes("json")) {
                    dataPromise = fetchResponse.json()
                } else {
                    dataPromise = fetchResponse.text()
                }
                dataPromise.then(data => {
                    if (fetchResponse.ok && status < 300 && status >= 200) {
                        const response = {
                            status,
                            data: data,
                            headers: fetchResponse.headers
                        };
                        for (let responseInterceptor of this.responseInterceptors) {
                            responseInterceptor(response)
                        }
                        resolve(response as unknown as R)
                    } else {
                        const errorResponse = {
                            status,
                            data,
                            headers: fetchResponse.headers
                        } as ErrorResponse;
                        for (let errorInterceptor of this.errorInterceptors) {
                            errorInterceptor(errorResponse)
                        }
                        reject(errorResponse)
                    }
                }).catch(reject)
            }).catch(reject)
                .finally(() => {
                    timeoutTimeout && clearTimeout(timeoutTimeout)
                })
        })

    }

}

export type RequestHeaderValue = string | []

export type RequestOptions = FetcherCommonOptions & {
    headers?: { [key: string]: RequestHeaderValue }
    responseType?: ResponseType
}

export type RequestParams = { [key: string]: RequestParamValue }

export type RequestParamValue = any

export const enum HttpMethod {
    GET = "GET",
    HEAD = "HEAD",
    POST = "POST",
    PUT = "PUT",
    PATCH = "PATCH",
    DELETE = "DELETE",
    OPTIONS = "OPTIONS",
    TRACE = "TRACE"
}

export type Response<D = void> = {
    status: number
    headers: Headers
    data: D
}

export type ErrorResponse = Response<any> | string

export const enum ResponseType {
    JSON, FORM_DATA, TEXT, BLOB, ARRAY_BUFFER
}
