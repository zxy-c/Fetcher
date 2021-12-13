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
    async post<D>(url: string, params: RequestParams = {}, body?: any | null, options?: RequestOptions): Promise<Response<D>> {
        return await this.execute(HttpMethod.POST, url, params, body, options)
    }

    // noinspection JSUnusedGlobalSymbols
    async put<D>(url: string, params: RequestParams = {}, body?: any | null, options?: RequestOptions): Promise<Response<D>> {
        return await this.execute(HttpMethod.PUT, url, params, body, options)
    }

    // noinspection JSUnusedGlobalSymbols
    async patch<D>(url: string, params: RequestParams = {}, body?: any | null, options?: RequestOptions): Promise<Response<D>> {
        return await this.execute(HttpMethod.PATCH, url, params, body, options)
    }

    // noinspection JSUnusedGlobalSymbols
    async get<D>(url: string, params: RequestParams = {}, options?: RequestOptions): Promise<Response<D>> {
        return await this.execute(HttpMethod.GET, url, params, null, options)
    }

    // noinspection JSUnusedGlobalSymbols
    async delete<D>(url: string, params: RequestParams = {}, options?: RequestOptions): Promise<Response<D>> {
        return await this.execute(HttpMethod.DELETE, url, params, null, options)
    }

    // noinspection JSUnusedGlobalSymbols
    async head<D>(url: string, params: RequestParams = {}, options?: RequestOptions): Promise<Response<D>> {
        return await this.execute(HttpMethod.HEAD, url, params, null, options)
    }

    // noinspection JSUnusedGlobalSymbols
    async trace<D>(url: string, params: RequestParams = {}, options?: RequestOptions): Promise<Response<D>> {
        return await this.execute(HttpMethod.TRACE, url, params, null, options)
    }

    // noinspection JSUnusedGlobalSymbols
    async options<D>(url: string, params: RequestParams = {}, options?: RequestOptions): Promise<Response<D>> {
        return await this.execute(HttpMethod.OPTIONS, url, params, null, options)
    }

    async execute<D>(method: HttpMethod = HttpMethod.GET, url: string, params: RequestParams = {}, body?: any | null, options?: RequestOptions): Promise<Response<D>> {
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
        if (timeout <= 0) {
            // Never timeout if timeout is zero
            setTimeout(() => {
                abortController.abort()
                throw "timeout"
            }, timeout)
        }
        const baseUrl = this.baseUrl ?? ""
        url = baseUrl.replace(/\/$/, "") + "/" + url.replace(/^\//, "")
        const paramString = paramsSerializer(params);
        url = paramString ? url + "?" + paramString : url
        let request: Request = {url, headers, params, body}
        for (let requestInterceptor of this.requestInterceptors) {
            request = requestInterceptor(request)
        }
        const fetchResponse = await fetch(request.url, request);
        const status = fetchResponse.status
        const responseType = options?.responseType;
        let data: any
        if (responseType != null) {
            switch (responseType) {
                case ResponseType.JSON:
                    data = await fetchResponse.json()
                    break;
                case ResponseType.FORM_DATA:
                    data = await fetchResponse.formData()
                    break;
                case ResponseType.TEXT:
                    data = await fetchResponse.text()
                    break;
                case ResponseType.BLOB:
                    data = await fetchResponse.blob()
                    break;
                case ResponseType.ARRAY_BUFFER:
                    data = await fetchResponse.arrayBuffer()
                    break;
            }
        } else if (fetchResponse.headers.get("Content-Type")?.includes("json")) {
            data = await fetchResponse.json()
        } else {
            data = await fetchResponse.text()
        }
        if (fetchResponse.ok && status < 300 && status >= 200) {
            const response = {
                status,
                data,
                headers: fetchResponse.headers
            };
            for (let responseInterceptor of this.responseInterceptors) {
                responseInterceptor(response)
            }
            return response
        } else {
            const errorResponse = {
                status,
                data,
                headers: fetchResponse.headers
            } as ErrorResponse;
            for (let errorInterceptor of this.errorInterceptors) {
                errorInterceptor(errorResponse)
            }
            throw errorResponse
        }
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
