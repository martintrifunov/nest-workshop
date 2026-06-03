export interface FieldSpec {
  source: string;
  target: string;
  type: string;
}

export interface ServiceSpec {
  fields: FieldSpec[];
}

export interface GatewayService {
  id: number;
  name: string;
  baseUrl: string;
  responseFormat: string;
  routePattern: string;
  authRequired: boolean;
  spec: ServiceSpec;
}

export interface AuthUser {
  username: string;
  sub: number;
  role: 'admin' | 'developer';
}

export interface RequestLog {
  id: number;
  serviceName: string;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  createdAt: string;
}
