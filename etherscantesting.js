import Moralis from "moralis/node.js";
import fetch from 'node-fetch';
const serverUrl = "https://kpvcez1i2tg3.usemoralis.com:2053/server";
const appId = "viZCI1CZimCj22ZTyFuXudn3g0wUnG2pELzPvdg6";
Moralis.start({ serverUrl, appId });

async function find_conversion_rate(ticker1,ticker2,timeline){ // gets price of ticker 1 in terms of ticker 2
    if((ticker1=="ETH" && ticker2=="WETH") || (ticker1=="WETH" && ticker2=="ETH") || ticker1==ticker2){
        return 1;
    }
    //https://api.covalenthq.com/v1/pricing/historical/eth/revv/
    //?quote-currency=USD&format=JSON&from=2021-12-31&to=2021-12-31&key=ckey_c4b9331412914d59845089270d0
    let part1="https://api.covalenthq.com/v1/pricing/historical/";
    let part2=ticker2;
    let part3="/";
    let part4=ticker1;
    let part5="/?quote-currency=USD&format=JSON&from=";
    let part6=timeline.slice(0,10);
    let part7="&to=";
    let part8=part6;
    let part9="&key=ckey_c4b9331412914d59845089270d0";
    let url_complete=part1.concat(part2,part3,part4,part5,part6,part7,part8,part9);
    const ans = await fetch(url_complete).then(response=>{return response.json();});
    //console.log(url_complete);
    //console.log(ans);
    if(ans==null || ans.data==null) return null;
    else{
       return ans.data.prices[0].price; 
    }
}

async function covalent_logs(txn_hash,waddress,NFTfrom,NFTto,chain_name){
    var chain_num;
    if(chain_name=='polygon'){
        chain_num="137";
    }
    else{
        chain_num="1";
    }
    let e1='https://api.covalenthq.com/v1/';
    let e2='/transaction_v2/';
    let part1=e1.concat(chain_num,e2);
    let part2=txn_hash;
    let part3='/?&key=';
    let part4='ckey_c4b9331412914d59845089270d';
    let url_complete=part1.concat(part2,part3,part4);
    const ans = await fetch(url_complete).then(response=>{return response.json();});
    var mainmoney=0,comission=0,i=0;
    if(ans.data!=null && ans.data.items!=null){
        for(i=0;i<ans.data.items[0].log_events.length;i++){
            if(ans.data.items[0].log_events[i].sender_contract_ticker_symbol=="ENS"){
                return [-1];
            }
        }
    }
    if(ans.data!=null && ans.data.items!=null){
        for(i=0;i<ans.data.items[0].log_events.length;i++){
            if( ans.data.items[0].log_events[i].decoded!=null 
                && ans.data.items[0].log_events[i].sender_contract_decimals==18
                && ans.data.items[0].log_events[i].decoded.name=="Transfer"
                && ans.data.items[0].log_events[i].decoded.params!=null 
                && ans.data.items[0].log_events[i].decoded.params[2].value!=null){
                const rate= await find_conversion_rate(ans.data.items[0].log_events[i].sender_contract_ticker_symbol,
                    "ETH",ans.data.items[0].log_events[i].block_signed_at);
                //console.log("Conversion Rate: ",rate," of 1 ",ans.data.items[0].log_events[i].sender_contract_ticker_symbol," to ETH");
                if(ans.data.items[0].log_events[i].decoded.params[1].value==NFTfrom){
                    mainmoney+=rate*parseInt(ans.data.items[0].log_events[i].decoded.params[2].value)/(10**18);
                    if(i+1<ans.data.items[0].log_events.length){
                        if(ans.data.items[0].log_events[i+1].decoded!=null 
                            && ans.data.items[0].log_events[i+1].sender_contract_decimals==18
                            && ans.data.items[0].log_events[i+1].decoded.name=="Transfer"
                            && ans.data.items[0].log_events[i+1].decoded.params[2].value!=null){
                                comission+=rate*parseInt(ans.data.items[0].log_events[i+1].decoded.params[2].value)/(10**18);
                        }
                    }
                    //return [mainmoney,comission];
                }
                else if(ans.data.items[0].log_events[i].decoded.params[0].value==NFTfrom){
                    mainmoney-=rate*parseInt(ans.data.items[0].log_events[i].decoded.params[2].value)/(10**18);
                    comission+=rate*parseInt(ans.data.items[0].log_events[i].decoded.params[2].value)/(10**18);
                }
            }
        }
    }
    if(mainmoney==0 && comission==0) return null;
    else return [mainmoney,comission,"ETH"];
}

async function etherscan_logs(txn_hash,waddress,NFTfrom,NFTto,chain_name){
    let part1= 'https://api.etherscan.io/api?module=account&action=txlistinternal&txhash=';
    let part2=txn_hash;
    let part3='&apikey=';
    let part4='3K72Z6I2T121TAQZ9DY34EF6F9NADKAH87';
    let url_complete=part1.concat(part2,part3,part4);
    const ans = await fetch(url_complete).then(response=>{return response.json();});
    var mainmoney=0,commission=0;
    var count_occurence=0;//useful for bundle
    var count_occurence2=0;
    for(var i=0;i<ans.result.length;i++){
        if(ans.result[i].value!=null){
            if(ans.result[i].to==NFTfrom){
                mainmoney+=parseInt(ans.result[i].value)/(10**18);
                count_occurence++;
                if(i-1>=0){
                    commission+=parseInt(ans.result[i-1].value)/(10**18);
                }
            }
            else if(ans.result[i].from==NFTfrom){
                count_occurence2++;
                mainmoney-=parseInt(ans.result[i].value)/(10**18);
                commission+=parseInt(ans.result[i].value)/(10**18);
            }
        }
    }
    if(mainmoney==0 && commission==0){
        return null;
    }
    else{
        if(count_occurence>0) return [mainmoney/count_occurence,commission/count_occurence,"ETH"];
        else if(count_occurence2>0) return [mainmoney/count_occurence2,commission/count_occurence2,"ETH"];
        else return [mainmoney,commission,"ETH"];
    }
}

async function polygonscan_logs(txn_hash,waddress,NFTfrom,NFTto,chain_name){
    let part1= 'https://api.polygonscan.com/api?module=account&action=txlistinternal&txhash=';
    let part2=txn_hash;
    let part3='&apikey=';
    let part4='KSPP4UMVPIGFV24FEA19RGND8XN9V3D3C3';
    let url_complete=part1.concat(part2,part3,part4);
    //console.log(url_complete);
    const ans = await fetch(url_complete).then(response=>{return response.json();});
    //console.log(ans);
    var mainmoney=0,commission=0;
    var count_occurence=0;//useful for bundle
    var count_occurence2=0;
    for(var i=0;i<ans.result.length;i++){
        if(ans.result[i].value!=null){
            if(ans.result[i].to==NFTfrom){
                mainmoney+=parseInt(ans.result[i].value)/(10**18);
                count_occurence++;
                if(i-1>=0){
                    commission+=parseInt(ans.result[i-1].value)/(10**18);
                }
            }
            else if(ans.result[i].from==NFTfrom){
                count_occurence2++;
                mainmoney-=parseInt(ans.result[i].value)/(10**18);
                commission+=parseInt(ans.result[i].value)/(10**18);
            }
        }
    }
    if(mainmoney==0 && commission==0){
        return null;
    }
    else{
        if(count_occurence>0) return [mainmoney/count_occurence,commission/count_occurence,"MATIC"];
        else if(count_occurence2>0) return [mainmoney/count_occurence2,commission/count_occurence2,"MATIC"];
        else return [mainmoney,commission,"MATIC"];
    }
}


async function value_from_hash(txn_hash,waddress,NFTfrom,NFTto,chain_name){
    const ans1= await covalent_logs(txn_hash,waddress,NFTfrom,NFTto,chain_name);
    if(ans1==[-1]){
        return -1;
    }
    else if(ans1==null && chain_name=="eth"){
        const ans2= await etherscan_logs(txn_hash,waddress,NFTfrom,NFTto,chain_name);
        return ans2;
    }
    else if(ans1==null && chain_name=="polygon"){
        const ans2= await polygonscan_logs(txn_hash,waddress,NFTfrom,NFTto,chain_name);
        return ans2;
    }
    else{
        return ans1;
    }
}


const chain_name="polygon";
const waddress="0x967a326a5241d349979c9c8ef150ce3a1a657652";
const options = { chain: chain_name, address: waddress,limit:"30"};
const transfersNFT = await Moralis.Web3API.account.getNFTTransfers(options);
console.log(transfersNFT);
console.log("For wallet address:",waddress," ,chain: ",chain_name,"\nFollowing are the NFT Transaction values: ")
var count=0;
for(var i=0;i<transfersNFT.result.length;i++){
    //console.log("Hello");
    const value_from_moralis=parseInt(transfersNFT.result[i].value)/(10**18);
    //console.log(transfersNFT.result[i].transaction_hash);
    const value_from_hash_scans=await value_from_hash(transfersNFT.result[i].transaction_hash,waddress,
                                                        transfersNFT.result[i].from_address,transfersNFT.result[i].to_address,chain_name);
    if(value_from_hash_scans==-1){
        continue;
    }
    //console.log(value_from_moralis,value_from_hash_scans);
    var final_value;
    if(value_from_hash_scans!=null){
        final_value=value_from_hash_scans;
        if(final_value[0]<0){
            let ticker1="ETH";
            if(chain_name=="polygon"){
                ticker1="MATIC";
            }
            const rate=await find_conversion_rate(ticker1,final_value[2],transfersNFT.result[i].block_timestamp);
            final_value[0]+=rate*value_from_moralis;
        }
    }
    else{
        final_value=[value_from_moralis,0,"MATIC"];
    }
    count++;
    if(transfersNFT.result[i].from_address==waddress){
        console.log(count,". Sold NFT. Revenue Increases. Value:",final_value[0],final_value[2],". Hash: ",transfersNFT.result[i].transaction_hash);
    }
    else{
        console.log(count,". Bought NFT. Spending Increases. Value:",final_value[0]+final_value[1],final_value[2],". Hash: ",transfersNFT.result[i].transaction_hash);
    }
    console.log("NFT went from: ",transfersNFT.result[i].from_address," to: ",transfersNFT.result[i].to_address);
}




