import { FastifyPluginAsync, RouteShorthandOptions } from "fastify";
import { generateTokenCluster } from "~/functions/token/generateTokenCluster";
import { verifyUserCredentials } from "~/functions/auth/verifyUserCredentials";
import { TokenClusterSchema } from "~/schemas/TokenClusterSchema";
import { ApiResponseType } from "~/types/global";
import { Static, Type } from "@sinclair/typebox";
import { getSuccessResponseSchema } from "~/utils/typebox";
import { setRefreshTokenInCookie } from "~/functions/token/setRefreshTokenInCookie";
import { omitKeys } from "~/utils/objects";

/** Typebox Schemas and Types */
namespace TB {
  /** The blueprint for the body */
  export const Body = Type.Object({
    email: Type.String({ format: "email" }),
    password: Type.String(),
    client: Type.String(), // mobile or web
  });
  export type BodyType = Static<typeof Body>;

  /** The blueprint for the data property in the response object */
  export const ResponseData = TokenClusterSchema;
  export type ResponseDataType = Static<typeof ResponseData>;

  /** The success response (200/201) */
  export const Response = getSuccessResponseSchema(ResponseData);
  export type ResponseType = ApiResponseType<ResponseDataType>;

  /** Props Interface */
  export interface Props {
    Body: BodyType;
  }
}

namespace Router {
  /** Config Options For Fastify Route */
  const options: RouteShorthandOptions = {
    schema: {
      body: TB.Body,
      response: { 200: TB.Response },
    },
  };

  /** Login Endpoint */
  export const route: FastifyPluginAsync = async (
    fastify,
    opts
  ): Promise<void> => {
    fastify.post<TB.Props>(
      "/login",
      options,
      async function (req, res): Promise<TB.ResponseType> {
        const { email, password, client } = req.body;

        const isWebClient = client === "web";

        const user = await verifyUserCredentials(email, password);
        const tokenCluster = await generateTokenCluster(user.id);

        if (isWebClient) {
          setRefreshTokenInCookie(res, tokenCluster.refreshToken);
        }

        res.status(200);
        return {
          ok: true,
          message: "Successfully Logged In",
          data: isWebClient
            ? omitKeys(tokenCluster, ["refreshToken"])
            : tokenCluster,
        };
      }
    );
  };
}

export default Router.route;
