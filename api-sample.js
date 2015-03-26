package com.brinkmat.api;
 
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.util.HashMap;
import java.util.Map;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.UriBuilder;
import net.sf.json.JSONArray;
import net.sf.json.JSONObject;
import com.sun.jersey.api.client.Client;
import com.sun.jersey.api.client.ClientResponse;
import com.sun.jersey.api.client.WebResource;
 
public class DcomRestExample
{
    final static String host = "http://sandbox.delivery.com/";
 
    final static String GUEST_TOKEN = "Guest-Token";
    final static String AUTH_TOKEN = "Authorization";
    final static String GUEST_TOKEN_URL = "customer/auth/guest";
    final static String CUSTOMER_CART_URL = "customer/cart";
    final static String CHECKOUT_URL = "customer/cart";
    final static String CC_URL = "customer/cc";
    final static String AUTH_URL = "customer/auth";
    final static String LOCATION_URL = "customer/location";
    final static String ORDER_URL = "customer/orders/recent";
    final static String SEARCH_URL = "merchant/search/delivery";   
    final static String SEARCH_ADDRESS = "1330 1st Ave, 10021";
    final static String ADDRESS_APT = "Apt 123";   
    final static String CLIENT_ID = "NDU1MWU1YjM4NzczMjljN2ZlNjFkODFkNDhlMjdkZGZk";   
    final static String ORDER_TYPE = "delivery";
 
 
    public static void main(String[] args) throws IOException
    {
 
    // 1) Go to https://staging.delivery.com , scroll to bottom, click
    // 'developers', click 'become api user'
    // 2) Enter info
    // 3) Remember your Client Id and Secret, and fill them in below
    // 4) click on 'add one' to add a URL redirect, enter 'http://localhost'
    // or whatever you want, click Add URI, and fill that URI in redirectURI
    // below
     
    String clientSecret = "OGpYvTZubYUUlqo2zkgwDbmr7sXGOK1UMCDXqFTE";
    String redirectURI = "http://localhost";
 
    String urlToAddCCInBrowser = "http://sandbox.delivery.com/third_party/credit_card/add?client_id=" + CLIENT_ID + "&redirect_uri=" + redirectURI
        + "&response_type=code&scope=global";
 
 
 
    // I can get a guest-token which allows me to create a cart before the user logs in.
    String guestToken = getGuestToken(CLIENT_ID);
 
 
    // search for a merchant at location from above
    JSONObject searchResults = search(SEARCH_ADDRESS);
    JSONObject geoCodedLocation = searchResults.getJSONObject("search_address");
    System.out.println("My address was geocoded to: " + geoCodedLocation);
    int merchantId = getWasabiLobbyId(searchResults);
    System.out.println("Successfully found merchant w/ id " + merchantId);
     
 
    // now that we have the merchant, let's get the menu
    String inventory = menu(merchantId);
    System.out.println("Inventory for " + merchantId + " is " + inventory);
 
    // now let's add stuff to our cart
    addSushi(guestToken, inventory, merchantId);
    System.out.println("Added some sushi to my cart. Yum...");
 
    // view the cart
    String cart = viewCart(guestToken, null, merchantId, geoCodedLocation);
    System.out.println("Cart with guest token : " + cart);
 
    String urlToAuthorizeInBrowser = "http://sandbox.delivery.com/third_party/authorize?client_id=" + CLIENT_ID + "&redirect_uri=" + redirectURI
        + "&response_type=code&scope=global&guest_token=" + guestToken;
    System.out.println("Please go to " + urlToAuthorizeInBrowser + " in your browser, sign in or create an account, and you'll be redirected "
        + "to a url that looks like http://localhost/?code=DH8uAFjSO5dq2Alzr37PZPyUZjsGEAgG6MhUcIS9&state=."
        + " Please copy the code portion of in the URL (DH8uAFjSO5dq2Alzr37PZPyUZjsGEAgG6MhUcIS9 in this "
        + "example) and paste it here. I'm waiting for that input :");
    String code = new BufferedReader(new InputStreamReader(System.in)).readLine();
    // Get an access token as a bridge between
    // unauthorizedSessionSpecificToken and an authorized user
    String accessToken = getAccessToken(code, CLIENT_ID, clientSecret, redirectURI);
     
    // view the cart
    cart = viewCart(null, accessToken, merchantId, geoCodedLocation);
    System.out.println("Cart with access token: " + cart);
 
    // get a location id which will be used throughout the api - this should
    // be the delivery address
    int locationId = createLocation(accessToken, geoCodedLocation, true, null);
    System.out.println("Successfully created a location with id " + locationId);
     
    // get the saved CCs for this user
    System.out.println("Do you want to add a credit card to this account?  Y or N");
    if (new BufferedReader(new InputStreamReader(System.in)).readLine().equalsIgnoreCase("y"))
    {
        System.out.println("Enter the CC info at " + urlToAddCCInBrowser + " . When done, enter 'done' to continue");
        while (!new BufferedReader(new InputStreamReader(System.in)).readLine().equalsIgnoreCase("done"))
        {
        System.out.println("Waiting for you to enter 'done' and hit enter");
        }
    }
    System.out.println("Attempting to place order");
     
    int ccId = Integer.parseInt(viewCCs(accessToken));
    Float tip = 2.5f;
    String orderNotes = "Please be nice to the doorman. He works so hard.";
 
    String order = checkout(accessToken, tip, orderNotes, ccId, locationId, merchantId);
    System.out.println("Just placed an order: " + order);
 
    // now let's get it back again
    int orderId = JSONObject.fromObject(order).getInt("order_id");
     
    String orderFromGet = getOrder(accessToken, orderId);
    System.out.println("Just got an order: " + orderFromGet);
    }
 
    private static String getAccessToken(String code, String clientId, String clientSecret, String redirectURI)
    {
    String url = "http://sandbox.delivery.com/api/third_party/access_token";
    WebResource resource = Client.create().
                resource(
                    UriBuilder.fromUri(url).clone().build().toASCIIString()
                    );
     
    JSONObject postData = new JSONObject();
    postData.put("client_id", clientId);
    postData.put("client_secret", clientSecret);
    postData.put("redirect_uri", redirectURI);
    postData.put("grant_type", "authorization_code");
    postData.put("code", code);
         
    ClientResponse resi = resource.accept(MediaType.APPLICATION_JSON).type(MediaType.APPLICATION_JSON).post(ClientResponse.class, postData.toString());
    if (resi.getStatus() == ClientResponse.Status.OK.getStatusCode())
    {
        return JSONObject.fromObject(resi.getEntity(String.class)).getString("access_token");
    } else
    {
        String rs = resi.getEntity(String.class);
        throw new RuntimeException(JSONObject.fromObject(rs).getString("error_description"));
    }
    }
 
    /**
     * This gives you a unique unauthorized code you'll use throughout the api
     *
     * @param clientId
     *            when you sign up for an API key, you'll get a client Id
     * @return
     */
    private static String getGuestToken(String clientId)
    {
    WebResource resource = Client.create().resource(UriBuilder.fromUri(host + GUEST_TOKEN_URL).queryParam("client_id", clientId).clone().build().toASCIIString());
    ClientResponse res = resource.type(MediaType.APPLICATION_JSON).get(ClientResponse.class);
 
    if (res.getStatus() == ClientResponse.Status.OK.getStatusCode())
    {
        String token = res.getEntity(String.class);
        return JSONObject.fromObject(token).getString("Guest-Token");
    } else
    {
        throw new RuntimeException(JSONObject.fromObject(res.getEntity(String.class)).getJSONArray("message").getJSONObject(0).getString("code"));
    }
    }
 
    private static int createLocation(String authToken, JSONObject location, boolean isDoormanBuilding, String aptNum)
    {
    WebResource resource = Client.create().resource(UriBuilder.fromUri(host + LOCATION_URL).clone().build().toASCIIString());
    JSONObject formData = new JSONObject();
    formData.put("street", location.get("street"));
    formData.put("unit_number", aptNum);
    formData.put("city", location.get("city"));
    formData.put("state", location.get("state"));
    formData.put("zip_code", location.get("zip_code"));
    formData.put("phone", "555-555-5555");
 
    ClientResponse res = resource
        .accept(MediaType.APPLICATION_JSON)
        .type(MediaType.APPLICATION_JSON)
        .header(AUTH_TOKEN, authToken)
        .post(ClientResponse.class, formData.toString());
 
    if (res.getStatus() == ClientResponse.Status.OK.getStatusCode())
    {
        String locationObj = res.getEntity(String.class);
        return Integer.parseInt(JSONObject.fromObject(locationObj).getJSONObject("location").getString("location_id"));
    } else
    {
        String err = res.getEntity(String.class);
        throw new RuntimeException(JSONObject.fromObject(err).getJSONArray("message").getJSONObject(0).getString("code"));
    }
    }
 
    private static JSONObject search(String address)
    {
    String url = host + SEARCH_URL;
 
    WebResource resource = Client.create().resource(UriBuilder.fromUri(url).queryParam("address", address).queryParam("client_id", CLIENT_ID).clone().build().toASCIIString());
    ClientResponse res = resource.type(MediaType.APPLICATION_FORM_URLENCODED_TYPE).get(ClientResponse.class);
 
    if (res.getStatus() == ClientResponse.Status.OK.getStatusCode())
    {
        String merchantInfoArray = res.getEntity(String.class);
        JSONObject searchResult = JSONObject.fromObject(merchantInfoArray);
        return searchResult;
    } else
    {
        String msg = JSONObject.fromObject(res.getEntity(String.class)).getJSONArray("message").getJSONObject(0).getString("code");
        throw new RuntimeException(msg);
    }
    }
     
    private static int getWasabiLobbyId(JSONObject searchResult)
    {
    JSONArray merchantArray = searchResult.getJSONArray("merchants");
    if (!merchantArray.isEmpty())
    {
        for (int i = 0; i < merchantArray.size(); i++)
        {
        String seoName = merchantArray.getJSONObject(i).getJSONObject("summary").getJSONObject("url").getString("short_tag");
        if (seoName.toLowerCase().contains("wasabi-lobby"))
        {
            return merchantArray.getJSONObject(i).getInt("id");
        }
        }
 
 
    }
 
    throw new RuntimeException("Can't find wasabi-lobby");
    }
 
 
    private static String menu(int merchantId)
    {
    String url = host + "merchant/" + merchantId + "/menu";
    WebResource resource = Client.create()
        .resource(UriBuilder.fromUri(url).clone().build().toASCIIString());
    ClientResponse res = resource.type(MediaType.APPLICATION_FORM_URLENCODED_TYPE).get(ClientResponse.class);
 
    if (res.getStatus() == ClientResponse.Status.OK.getStatusCode())
    {
        String inventory = res.getEntity(String.class);
        return inventory;
    } else
    {
        throw new RuntimeException(JSONObject.fromObject(res.getEntity(String.class)).getJSONArray("message").getJSONObject(0).getString("code"));
    }
    }
 
    private static void addSushi(String authToken, String inventoryStr, Integer merchantId)
    {
    JSONObject inventory = JSONObject.fromObject(inventoryStr);
    // We need all this info
    String itemId = null;
    Integer quantity = null;
    String itemNotes = "Extra fishies please";// optional
    Map<String,Integer> optionQuantities = new HashMap<String,Integer>();
 
 
    JSONArray menus = inventory.getJSONArray("menu");
    for (int i = 0; i < menus.size(); i++)
    {
        //I'm using the "Full Menu" because it doesn't have a schedule. It's available all day.
        if (menus.getJSONObject(i).getString("name").equals("Full Menu"))
        {
        JSONArray fullMenuSections = menus.getJSONObject(i).getJSONArray("children");
        for(int j = 0; j < fullMenuSections.size(); j++)
        {
            //I feel like a normal sushi rull so I just want to view that section of the menu
            if(fullMenuSections.getJSONObject(j).getString("name").equals("Rolls & Hand Rolls"))
            {
            JSONArray rolls = fullMenuSections.getJSONObject(j).getJSONArray("children");
            for(int k = 0; k < rolls.size(); k++)
            {
                //I'm craving fish so I'm going to get a spicy tuna roll.
                if(rolls.getJSONObject(k).getString("name").equals("Spicy Tuna Roll"))
                {
                JSONObject spicyTunaRoll = rolls.getJSONObject(k);
                JSONArray  rollOptions = spicyTunaRoll.getJSONArray("children");
                 
                itemId = spicyTunaRoll.getString("id");
                quantity = spicyTunaRoll.getInt("max_qty"); //I'm going to add the max quantity so I'm sure I'll be over the order minimum for this merchant.
                 
                //Now I'm going to make sure I select any required options for this item
                for(int l = 0; l < rollOptions.size(); l++)
                {
                    JSONObject rollOptionGroup = rollOptions.getJSONObject(l);
                     
                    //Skipping any options that aren't required
                    if(rollOptionGroup.getInt("min_selection") > 0)
                    {
                    JSONArray options = rollOptionGroup.getJSONArray("children");
                     
                    //I'm going to add the first one, using a minimum required quantity
                    optionQuantities.put(options.getJSONObject(0).getString("id"), rollOptionGroup.getInt("min_selection"));
                    }
                    else
                    {
                    continue;
                    }
                }  
                }
            }          
            }
        }
        }
    }
 
    WebResource resource = Client.create().resource(UriBuilder.fromUri(host + CUSTOMER_CART_URL + "/" + merchantId).clone().build().toASCIIString());
    JSONObject formData = new JSONObject();
    formData.put("order_type", ORDER_TYPE);
    formData.put("client_id", CLIENT_ID);
    formData.put("instructions", itemNotes);
    String optionKeyToQuantity = "";
    for(Map.Entry<String, Integer> option : optionQuantities.entrySet())
        optionKeyToQuantity += "\"" + option.getKey() + "\": " + option.getValue() + ",";
    String itemJsonString = "{" +
                            "\"item_id\": \"" + itemId + "\"," +
                            "\"item_qty\": " + quantity + "," +
                            "\"option_qty\": {" + optionKeyToQuantity + "}," +                         
                        "}";
    JSONObject item = JSONObject.fromObject(itemJsonString);
    formData.put("item", item.toString());
 
    ClientResponse res = resource.accept(MediaType.APPLICATION_JSON)
        .type(MediaType.APPLICATION_JSON)
        .header(GUEST_TOKEN, authToken)
        .post(ClientResponse.class, formData.toString());
 
 
    if (res.getStatus() == ClientResponse.Status.OK.getStatusCode())
    {
        return;
    } else
    {
        throw new RuntimeException(JSONObject.fromObject(res.getEntity(String.class)).getJSONArray("message").getJSONObject(0).getString("code"));
    }
    }
 
    private static String viewCart(String guestToken, String accessToken, Integer merchantId, JSONObject address)
    {
    String url = host + CUSTOMER_CART_URL + "/" + merchantId;
    WebResource resource = Client.create()
                .resource(UriBuilder.fromUri(url)
                    .queryParam("client_id", CLIENT_ID)
                    .queryParam("zip", address.getString("zip_code"))
                    .queryParam("city", address.getString("city"))
                    .queryParam("state", address.getString("state"))
                    .queryParam("latitude", address.getString("latitude"))
                    .queryParam("longitude", address.getString("longitude"))
                    .clone().build().toASCIIString());
    ClientResponse res = resource.type(MediaType.APPLICATION_FORM_URLENCODED_TYPE)
                .header((guestToken == null) ? AUTH_TOKEN : GUEST_TOKEN, (guestToken == null) ? accessToken : guestToken)
                .get(ClientResponse.class);
 
    if (res.getStatus() == ClientResponse.Status.OK.getStatusCode())
    {
        String cart = res.getEntity(String.class);
        return cart;
    } else
    {
        throw new RuntimeException(JSONObject.fromObject(res.getEntity(String.class)).getJSONArray("message").getJSONObject(0).getString("code"));
    }
    }
 
    private static String getOrder(String authToken, int orderId)
    {
    WebResource resource = Client.create().resource(UriBuilder.fromUri(host + ORDER_URL + "/" + orderId).clone().build().toASCIIString());
    ClientResponse res = resource.type(MediaType.APPLICATION_JSON).header(AUTH_TOKEN, authToken).get(ClientResponse.class);
 
    if (res.getStatus() == ClientResponse.Status.OK.getStatusCode())
    {
        String order = res.getEntity(String.class);
        return order;
    } else
    {
        throw new RuntimeException(JSONObject.fromObject(res.getEntity(String.class)).getJSONArray("message").getJSONObject(0).getString("code"));
    }
    }
 
    private static String viewCCs(final String authToken)
    {
    String url = host + CC_URL;
    WebResource resource = Client.create().resource(UriBuilder.fromUri(url).clone().build().toASCIIString());
    ClientResponse res = resource.type(MediaType.APPLICATION_FORM_URLENCODED_TYPE).header(AUTH_TOKEN, authToken).get(ClientResponse.class);
 
    if (res.getStatus() == ClientResponse.Status.OK.getStatusCode())
    {
        JSONArray ccInfoArray = JSONObject.fromObject(res.getEntity(String.class)).getJSONArray("cards");
        if (ccInfoArray.isEmpty())
        {
        throw new RuntimeException("You need to add a credit card! Rerun me and do that");
        } else
        {
        return ccInfoArray.getJSONObject(0).getString("cc_id");
        }
    } else
    {
        throw new RuntimeException(JSONObject.fromObject(res.getEntity(String.class)).getJSONArray("message").getJSONObject(0).getString("code"));
    }
    }
 
    private static String checkout(String authToken, float tip, String orderNotes, int ccId, int locationId, int merchantId)
    {
    WebResource resource = Client.create().resource(UriBuilder.fromUri(host + CHECKOUT_URL + "/" + merchantId + "/checkout").clone().build().toASCIIString());
    JSONObject formData = new JSONObject();
    formData.put("instructions", orderNotes);
    formData.put("tip", tip);
    formData.put("location_id", locationId);
    formData.put("order_type", "delivery");
     
    JSONArray payments = new JSONArray();
    JSONObject payment =  new JSONObject();
    payment.put("type", "credit_card");
    payment.put("id", ccId);
    payments.add(payment);
    formData.put("payments", payments);
 
    ClientResponse res = resource.accept(MediaType.APPLICATION_JSON)
        .type(MediaType.APPLICATION_JSON).header(AUTH_TOKEN, authToken)
        .post(ClientResponse.class, formData.toString());
 
    if (res.getStatus() == ClientResponse.Status.OK.getStatusCode())
    {
        return res.getEntity(String.class);
    } else
    {
        throw new RuntimeException(JSONObject.fromObject(res.getEntity(String.class)).getJSONArray("message").getJSONObject(0).getString("code"));
    }
    }
}
